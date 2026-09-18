import { COUNCIL_FIXTURE } from "@/lib/council-fixture";

export function GET() {
  return Response.json(COUNCIL_FIXTURE);
}
