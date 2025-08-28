
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deptcode = searchParams.get('deptcode');

    const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    let sql = `
      SELECT
        workdate,
        person_code,
        deptcode,
        deptname,
        full_name,
        department_full_paths,
        firstscantime,
        shiftname,
        "PersonType"
      FROM public.vw_manpower_detail
      WHERE workdate = $1
        AND person_code IS NOT NULL
        AND person_code != ''
    `;
    const queryParams: (string | null)[] = [today];
    
    if (deptcode && deptcode !== 'all') {
      sql += ` AND deptcode = $${queryParams.length + 1}`;
      queryParams.push(deptcode);
    }

    const result = await query(sql, queryParams);

    if (result.rows.length === 0) {
      return NextResponse.json({ detil: [], message: "No data found" }, { status: 200 });
    }

    return NextResponse.json({ detil: result.rows }, { status: 200 });

  } catch (err) {
    console.error("API Error:", err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
