import { NextRequest } from 'next/server';
import db from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; 

    const result = await db.query(
      'SELECT * FROM public.vw_manpower WHERE workdate = $1 ORDER BY deptcode ASC',
      [date]
    );

    return new Response(JSON.stringify(result.rows), { status: 200 });
  } catch (err) {
    console.error('Failed to fetch department:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
