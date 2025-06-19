import { NextRequest, NextResponse } from 'next/server';
import db from '@/services/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const personCode = searchParams.get('person_code');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!personCode || !from || !to) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const sql = `
      SELECT
        workdate,
        person_code,
        deptcode,
        deptname,
        full_name,
        department_full_paths,
        firstscantime,
        lastscantime,
        shiftname,
        "PersonType"
      FROM public.vw_manpower_detail
      WHERE person_code = $1
        AND workdate BETWEEN $2 AND $3
      ORDER BY workdate ASC, full_name
    `;
    const values = [personCode, from, to];
    const result = await db.query(sql, values);

    return NextResponse.json({ records: result.rows });
  } catch (error) {
    console.error('[ERROR] Failed to fetch attendance records:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
