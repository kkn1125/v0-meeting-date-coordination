import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from("rooms")
      .select("*", { count: "exact", head: true })

    if (error) throw error

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error("Room count error:", error)
    return NextResponse.json({ count: 0 })
  }
}
