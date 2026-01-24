
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const functions = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DISTINCT funcao FROM stg_alterdata_v2 
      WHERE funcao IS NOT NULL AND funcao != ''
      ORDER BY funcao ASC
    `);

    const list = functions.map(f => f.funcao);
    
    return NextResponse.json({
      total: list.length,
      funcoes: list
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
