import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, BrainCircuit, DatabaseZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    title: "Direct S3 Uploads",
    description: "Upload documents from browser to S3 with pre-signed URLs for secure, scalable ingestion.",
    icon: DatabaseZap
  },
  {
    title: "AI Extraction",
    description: "Process files with Lambda + Gemini to classify, extract fields, and generate summaries.",
    icon: BrainCircuit
  },
  {
    title: "Approval Workflow",
    description: "Add a human-in-the-loop step before finalizing records in DynamoDB.",
    icon: ShieldCheck
  }
];

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <section className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-lg font-semibold text-slate-900">DocuPilot</p>
          <div className="flex gap-2">
            <Link href="/sign-in">
              <Button variant="outline">Sign in</Button>
            </Link>
            <Link href="/dashboard">
              <Button>Open dashboard</Button>
            </Link>
          </div>
        </section>

        <Card className="mb-6">
          <CardHeader>
            <Badge className="w-fit">Serverless AI Workflow</Badge>
            <CardTitle className="mt-3 text-4xl leading-tight">AI document processing on serverless AWS</CardTitle>
            <CardDescription className="max-w-3xl text-base leading-relaxed">
              DocuPilot combines Next.js, Clerk auth, API Gateway, Lambda, Step Functions, S3, and Gemini into a
              practical document pipeline for upload, extraction, classification, summary, and approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button>
                Go to command center
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="h-5 w-5 text-sky-600" />
                <CardTitle className="mt-2 text-xl">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
