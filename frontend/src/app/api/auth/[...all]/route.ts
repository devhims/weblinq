import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Frontend auth routes removed - using direct backend connection',
    },
    { status: 410 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Frontend auth routes removed - using direct backend connection',
    },
    { status: 410 },
  );
}
