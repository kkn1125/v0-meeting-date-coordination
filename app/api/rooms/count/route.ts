import { NextResponse } from "next/server"
import { getRoomCount } from "@/lib/db/queries"

export async function GET() {
  try {
    const count = await getRoomCount()
    return NextResponse.json({ count })
  } catch (error) {
    console.error("Room count error:", error)
    return NextResponse.json({ count: 0 })
  }
}
