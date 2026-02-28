// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PayrollRegistry
 * @notice Onchain payroll system on Polygon — supports lump-sum and per-second
 *         streaming payments in native POL or any ERC-20 token (e.g. USDC).
 * @dev    Each EOA/contract can register exactly one Company. Employees are
 *         keyed by (employer, employeeWallet). Funds are held in this contract
 *         per (employer, token) bucket and drawn during payroll / stream claims.
 */
contract PayrollRegistry is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────

    /// @dev address(0) represents native POL throughout this contract
    address public constant NATIVE_TOKEN = address(0);

    /// @dev Minimum seconds between lump-sum payroll runs per employee (28 days)
    ///      Set a shorter value when registering your company for testnet demos.
    uint256 public constant DEFAULT_PAYROLL_INTERVAL = 28 days;

    // ─────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────

    enum PaymentType {
        LUMP_SUM,
        STREAMING
    }

    struct Company {
        string name;
        string description;
        bool isRegistered;
        uint256 createdAt;
        /// @dev seconds between payroll runs — employer sets this at registration
        uint256 payrollInterval;
    }

    struct Employee {
        address wallet;
        string name;
        string role;
        /// @dev address(0) = native POL; any ERC-20 address otherwise
        address token;
        /// @dev monthly / per-run salary in token's smallest unit (LUMP_SUM)
        uint256 monthlySalary;
        /// @dev tokens-per-second in token's smallest unit (STREAMING)
        uint256 streamRate;
        PaymentType paymentType;
        bool isActive;
        uint256 addedAt;
        /// @dev timestamp of last lump-sum payment (0 = never paid)
        uint256 lastPaidAt;
        /// @dev timestamp when the current stream epoch started
        uint256 streamStartedAt;
        /// @dev cumulative tokens claimed from the current stream epoch
        uint256 streamClaimedAmount;
    }

    // ─────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────

    /// employer address → Company
    mapping(address => Company) public companies;

    /// employer → ordered list of employee wallets (includes inactive)
    mapping(address => address[]) private _employeeAddresses;

    /// employer → employee wallet → Employee
    mapping(address => mapping(address => Employee)) public employees;

    /// employer → token → deposited balance held in this contract
    mapping(address => mapping(address => uint256)) public deposits;

    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────

    event CompanyRegistered(address indexed employer, string name, uint256 payrollInterval, uint256 timestamp);
    event EmployeeAdded(address indexed employer, address indexed employee, string name, PaymentType paymentType, address token);
    event EmployeeRemoved(address indexed employer, address indexed employee, uint256 timestamp);
    event SalaryUpdated(address indexed employer, address indexed employee, uint256 newMonthlySalary, uint256 newStreamRate);
    event PayrollExecuted(address indexed employer, uint256 timestamp, uint256 paidCount);
    event EmployeePaid(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp);
    event StreamClaimed(address indexed employer, address indexed employee, address indexed token, uint256 amount, uint256 timestamp);
    event FundsDeposited(address indexed employer, address token, uint256 amount, uint256 timestamp);
    event FundsWithdrawn(address indexed employer, address token, uint256 amount, uint256 timestamp);

    // ─────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────

    error CompanyNotRegistered();
    error CompanyAlreadyRegistered();
    error EmployeeAlreadyActive();
    error EmployeeNotFound();
    error InsufficientDeposit(address token, uint256 required, uint256 available);
    error PayrollIntervalNotReached(address employee, uint256 nextPaymentAt);
    error ZeroAddress();
    error ZeroAmount();
    error NotStreamingEmployee();
    error NothingToClaim();
    error EmptyName();
    error NoLumpSumEmployeesDue();

    // ─────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────

    modifier onlyRegistered() {
        if (!companies[msg.sender].isRegistered) revert CompanyNotRegistered();
        _;
    }

    // ─────────────────────────────────────────────
    // Company Management
    // ─────────────────────────────────────────────

    /**
     * @notice Register a company. Each address may register once.
     * @param name             Human-readable company name
     * @param description      Short description / mission
     * @param payrollInterval  Seconds between payroll runs (0 = DEFAULT_PAYROLL_INTERVAL)
     *                         Use 60 for quick testnet demos.
     */
    function registerCompany(
        string calldata name,
        string calldata description,
        uint256 payrollInterval
    ) external {
        if (companies[msg.sender].isRegistered) revert CompanyAlreadyRegistered();
        if (bytes(name).length == 0) revert EmptyName();

        uint256 interval = payrollInterval == 0 ? DEFAULT_PAYROLL_INTERVAL : payrollInterval;

        companies[msg.sender] = Company({
            name: name,
            description: description,
            isRegistered: true,
            createdAt: block.timestamp,
            payrollInterval: interval
        });

        emit CompanyRegistered(msg.sender, name, interval, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Employee Management
    // ─────────────────────────────────────────────

    /**
     * @notice Add a new employee to the caller's company.
     * @param wallet         Employee's wallet address
     * @param name           Employee name
     * @param role           Job role / title
     * @param token          Payment token (address(0) for native POL)
     * @param monthlySalary  Amount per payroll run in token's smallest unit (LUMP_SUM)
     * @param streamRate     Tokens per second in token's smallest unit (STREAMING)
     * @param paymentType    0 = LUMP_SUM, 1 = STREAMING
     */
    function addEmployee(
        address wallet,
        string calldata name,
        string calldata role,
        address token,
        uint256 monthlySalary,
        uint256 streamRate,
        PaymentType paymentType
    ) external onlyRegistered {
        if (wallet == address(0)) revert ZeroAddress();
        if (employees[msg.sender][wallet].isActive) revert EmployeeAlreadyActive();
        if (bytes(name).length == 0) revert EmptyName();
        if (paymentType == PaymentType.LUMP_SUM && monthlySalary == 0) revert ZeroAmount();
        if (paymentType == PaymentType.STREAMING && streamRate == 0) revert ZeroAmount();

        employees[msg.sender][wallet] = Employee({
            wallet: wallet,
            name: name,
            role: role,
            token: token,
            monthlySalary: monthlySalary,
            streamRate: streamRate,
            paymentType: paymentType,
            isActive: true,
            addedAt: block.timestamp,
            lastPaidAt: 0,
            streamStartedAt: paymentType == PaymentType.STREAMING ? block.timestamp : 0,
            streamClaimedAmount: 0
        });

        _employeeAddresses[msg.sender].push(wallet);

        emit EmployeeAdded(msg.sender, wallet, name, paymentType, token);
    }

    /**
     * @notice Deactivate an employee. If they were streaming, auto-settles
     *         their claimable balance before deactivation.
     */
    function removeEmployee(address employeeWallet) external onlyRegistered {
        Employee storage emp = employees[msg.sender][employeeWallet];
        if (!emp.isActive) revert EmployeeNotFound();

        // Auto-settle outstanding stream balance
        if (emp.paymentType == PaymentType.STREAMING && emp.streamStartedAt > 0) {
            _settleStream(msg.sender, employeeWallet);
        }

        emp.isActive = false;
        emit EmployeeRemoved(msg.sender, employeeWallet, block.timestamp);
    }

    /**
     * @notice Update salary or stream rate for an active employee.
     *         For streaming employees, the current epoch is settled first and
     *         a new epoch begins with the updated rate.
     */
    function updateSalary(
        address employeeWallet,
        uint256 newMonthlySalary,
        uint256 newStreamRate
    ) external onlyRegistered {
        Employee storage emp = employees[msg.sender][employeeWallet];
        if (!emp.isActive) revert EmployeeNotFound();

        if (emp.paymentType == PaymentType.STREAMING) {
            _settleStream(msg.sender, employeeWallet);
            emp.streamStartedAt = block.timestamp;
            emp.streamClaimedAmount = 0;
            emp.streamRate = newStreamRate;
        }

        emp.monthlySalary = newMonthlySalary;
        emit SalaryUpdated(msg.sender, employeeWallet, newMonthlySalary, newStreamRate);
    }

    // ─────────────────────────────────────────────
    // Funds Management
    // ─────────────────────────────────────────────

    /**
     * @notice Deposit payroll funds into the contract.
     * @param token   address(0) to deposit native POL (send msg.value);
     *                ERC-20 address to deposit that token (must have approval).
     * @param amount  For ERC-20 only — ignored for native POL.
     */
    function depositFunds(address token, uint256 amount) external payable onlyRegistered {
        if (token == NATIVE_TOKEN) {
            if (msg.value == 0) revert ZeroAmount();
            deposits[msg.sender][NATIVE_TOKEN] += msg.value;
            emit FundsDeposited(msg.sender, NATIVE_TOKEN, msg.value, block.timestamp);
        } else {
            if (amount == 0) revert ZeroAmount();
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
            deposits[msg.sender][token] += amount;
            emit FundsDeposited(msg.sender, token, amount, block.timestamp);
        }
    }

    /**
     * @notice Withdraw unused payroll funds. Only callable by the employer.
     */
    function withdrawFunds(address token, uint256 amount) external onlyRegistered nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = deposits[msg.sender][token];
        if (available < amount) revert InsufficientDeposit(token, amount, available);

        deposits[msg.sender][token] -= amount;
        _transferToken(token, msg.sender, amount);

        emit FundsWithdrawn(msg.sender, token, amount, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // Payroll Execution
    // ─────────────────────────────────────────────

    /**
     * @notice Execute lump-sum payroll for all due employees.
     *         Skips employees whose payroll interval has not elapsed.
     *         Reverts if any due employee's payment cannot be funded.
     */
    function executePayroll() external onlyRegistered nonReentrant {
        address[] memory addrs = _employeeAddresses[msg.sender];
        uint256 interval = companies[msg.sender].payrollInterval;
        uint256 paidCount = 0;

        for (uint256 i = 0; i < addrs.length; i++) {
            Employee storage emp = employees[msg.sender][addrs[i]];

            if (!emp.isActive || emp.paymentType != PaymentType.LUMP_SUM) continue;

            bool firstPayment = emp.lastPaidAt == 0;
            bool intervalElapsed = !firstPayment && (block.timestamp - emp.lastPaidAt >= interval);

            if (!firstPayment && !intervalElapsed) continue;

            uint256 available = deposits[msg.sender][emp.token];
            if (available < emp.monthlySalary) {
                revert InsufficientDeposit(emp.token, emp.monthlySalary, available);
            }

            deposits[msg.sender][emp.token] -= emp.monthlySalary;
            emp.lastPaidAt = block.timestamp;
            paidCount++;

            _transferToken(emp.token, emp.wallet, emp.monthlySalary);
            emit EmployeePaid(msg.sender, emp.wallet, emp.token, emp.monthlySalary, block.timestamp);
        }

        if (paidCount == 0) revert NoLumpSumEmployeesDue();

        emit PayrollExecuted(msg.sender, block.timestamp, paidCount);
    }

    // ─────────────────────────────────────────────
    // Stream Claims
    // ─────────────────────────────────────────────

    /**
     * @notice Employee calls this to claim their accrued stream balance.
     * @param employer  The employer whose payroll stream to claim from.
     */
    function claimStream(address employer) external nonReentrant {
        Employee storage emp = employees[employer][msg.sender];
        if (!emp.isActive) revert EmployeeNotFound();
        if (emp.paymentType != PaymentType.STREAMING) revert NotStreamingEmployee();

        uint256 claimable = getStreamableAmount(employer, msg.sender);
        if (claimable == 0) revert NothingToClaim();

        // Cap at available deposit so the tx doesn't revert
        uint256 available = deposits[employer][emp.token];
        if (claimable > available) claimable = available;
        if (claimable == 0) revert InsufficientDeposit(emp.token, 1, 0);

        deposits[employer][emp.token] -= claimable;
        emp.streamClaimedAmount += claimable;

        _transferToken(emp.token, msg.sender, claimable);
        emit StreamClaimed(employer, msg.sender, emp.token, claimable, block.timestamp);
    }

    // ─────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Returns the amount an employee can currently claim from their stream.
     */
    function getStreamableAmount(address employer, address employee) public view returns (uint256) {
        Employee storage emp = employees[employer][employee];
        if (!emp.isActive || emp.paymentType != PaymentType.STREAMING || emp.streamStartedAt == 0) {
            return 0;
        }
        uint256 elapsed = block.timestamp - emp.streamStartedAt;
        uint256 totalEarned = elapsed * emp.streamRate;
        if (totalEarned <= emp.streamClaimedAmount) return 0;
        return totalEarned - emp.streamClaimedAmount;
    }

    /**
     * @notice Returns all employee addresses and their data for a given employer.
     *         Includes inactive employees — filter by isActive in the frontend.
     */
    function getEmployees(address employer)
        external
        view
        returns (address[] memory addrs, Employee[] memory emps)
    {
        addrs = _employeeAddresses[employer];
        emps = new Employee[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            emps[i] = employees[employer][addrs[i]];
        }
    }

    /**
     * @notice Returns the deposit balance for a given employer and token.
     */
    function getDeposit(address employer, address token) external view returns (uint256) {
        return deposits[employer][token];
    }

    /**
     * @notice Returns true if the employer's company is registered.
     */
    function isRegistered(address employer) external view returns (bool) {
        return companies[employer].isRegistered;
    }

    /**
     * @notice Returns the next payroll timestamp for a lump-sum employee.
     */
    function nextPayrollAt(address employer, address employee) external view returns (uint256) {
        Employee storage emp = employees[employer][employee];
        if (!emp.isActive || emp.paymentType != PaymentType.LUMP_SUM) return 0;
        if (emp.lastPaidAt == 0) return block.timestamp; // due immediately
        return emp.lastPaidAt + companies[employer].payrollInterval;
    }

    // ─────────────────────────────────────────────
    // Internal Helpers
    // ─────────────────────────────────────────────

    /// @dev Settles outstanding stream balance for an employee (used on removal/update).
    function _settleStream(address employer, address employeeWallet) internal {
        uint256 claimable = getStreamableAmount(employer, employeeWallet);
        if (claimable == 0) return;

        Employee storage emp = employees[employer][employeeWallet];
        uint256 available = deposits[employer][emp.token];
        if (claimable > available) claimable = available;
        if (claimable == 0) return;

        deposits[employer][emp.token] -= claimable;
        emp.streamClaimedAmount += claimable;

        _transferToken(emp.token, employeeWallet, claimable);
        emit StreamClaimed(employer, employeeWallet, emp.token, claimable, block.timestamp);
    }

    /// @dev Transfers native POL or ERC-20 to a recipient.
    function _transferToken(address token, address to, uint256 amount) internal {
        if (token == NATIVE_TOKEN) {
            (bool ok,) = to.call{value: amount}("");
            require(ok, "POL transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }

    receive() external payable {}
}
