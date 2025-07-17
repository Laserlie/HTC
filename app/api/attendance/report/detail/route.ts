import { NextRequest, NextResponse } from 'next/server';
import db from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    console.log('API: Start processing request');
    const { searchParams } = new URL(req.url);
    const deptcode = searchParams.get('deptcode');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const today = new Date().toISOString().split('T')[0];
    const finalFrom = from && from !== 'null' && from !== 'undefined' ? from : today;
    const finalTo = to && to !== 'null' && to !== 'undefined' ? to : finalFrom;

    if (!deptcode || deptcode === 'undefined' || deptcode === 'null' || deptcode === '') {
      console.error('API Error: Missing or invalid deptcode received:', deptcode);
      return NextResponse.json(
        { error: 'รหัสแผนกไม่ถูกต้อง หรือไม่ได้ระบุ' },
        { status: 400 }
      );
    }

    const sql = `
      SELECT
        workdate,
        person_code,
        htcpersoncode,
        deptcode,
        deptname,
        htcpersoncode,
        full_name,
        department_full_paths,
        firstscantime,
        lastscantime,
        shiftname,
        "PersonType"
      FROM public.vw_manpower_detail
      WHERE deptcode = $1
        AND workdate BETWEEN $2 AND $3
      ORDER BY workdate, full_name
    `;

    console.log(`API: Executing SQL with params: deptcode=${deptcode}, from=${finalFrom}, to=${finalTo}`);
    console.log(`API: SQL Query: ${sql}`);

    const result = await db.query(sql, [deptcode, finalFrom, finalTo]);

    console.log('API: Query executed successfully');

    const deptName = result.rows.length > 0 ? result.rows[0].deptname : 'ไม่พบชื่อแผนก';

    console.log(`API: Found ${result.rows.length} records for deptcode: ${deptcode}`);

    return NextResponse.json(
      {
        deptname: deptName,
        detil: result.rows,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('API Error: attendance/report/detail:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในฝั่งเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}