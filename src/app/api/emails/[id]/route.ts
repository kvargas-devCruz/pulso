import { connection } from "next/server";
import { handle, store } from "@/lib/api";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  return handle(async () => {
    const { id } = await ctx.params;
    const s = store();
    const email = (await s.listEmails()).find((e) => e.id === id);
    if (!email) throw new Error("No encontré ese correo.");
    const extraction = (await s.listExtractions()).find((x) => x.emailId === id) ?? null;
    return { email, extraction };
  });
}
