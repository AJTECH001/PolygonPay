import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let payrollData: unknown;
  try {
    const body = await req.json();
    payrollData = body.payrollData;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const systemPrompt = `You are an expert financial analyst specializing in onchain payroll systems and decentralized finance (DeFi).
You analyze payroll data for blockchain companies and provide actionable insights.
Always respond with valid JSON in exactly this structure, no markdown, no extra text:
{
  "anomalies": [
    { "title": "string", "description": "string", "severity": "high|medium|low" }
  ],
  "insights": [
    { "title": "string", "description": "string" }
  ],
  "recommendations": [
    { "title": "string", "description": "string" }
  ]
}`;

  const userPrompt = `Analyze this onchain payroll data for a company running payroll on the Polygon blockchain:

${JSON.stringify(payrollData, null, 2)}

Evaluate the following and populate each section of the JSON response:

ANOMALIES — Flag potential problems:
1. Salary outliers (employees paid significantly more/less than peers in similar roles)
2. Employees added but never paid (high lastPaidDaysAgo)
3. Single-token concentration risk (all employees paid in one volatile token)
4. Streaming employees with extremely low or high rates

INSIGHTS — Positive observations:
1. Payment diversity and risk distribution
2. Streaming vs lump-sum balance
3. Estimated annual payroll savings vs traditional banking (assume 3% wire fees)
4. Cross-border payment efficiency

RECOMMENDATIONS — Actionable improvements:
1. Token diversification (e.g., switch some salaries to USDC for stability)
2. Streaming for certain roles (engineers benefit from real-time pay)
3. Payroll scheduling optimizations
4. Fund runway suggestions based on current employee count and salaries

Be specific and data-driven. Reference actual numbers from the data.`;

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Parse and validate the JSON response
    let analysis: unknown;
    try {
      analysis = JSON.parse(content.text);
    } catch {
      // If Claude returned markdown-wrapped JSON, strip it
      const jsonMatch = content.text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error("Claude returned non-JSON response");
      }
    }

    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    console.error("AI analysis error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
