import { NextRequest, NextResponse } from 'next/server';
import db from '@/services/db';

// กำหนด Type ของข้อมูลสำหรับแต่ละแถวที่ได้จากฐานข้อมูล
// (Define the data type for each row from the database)
type Detail = {
  workdate: string;
  person_code: string;
  htcpersoncode: string;
  deptcode: string;
  deptname: string;
  full_name: string;
  department_full_paths: string;
  firstscantime: string | null;
  lastscantime: string | null;
  shiftname: string;
  PersonType: string;
};

export async function GET(req: NextRequest) {
  try {
    console.log('API: Start processing report detail request');
    const { searchParams } = new URL(req.url);

    const deptcodesParam = searchParams.get('deptcodes');
    const workdateParam = searchParams.get('workdate');

    if (!deptcodesParam || deptcodesParam === '' || !workdateParam || workdateParam === '') {
      console.error('API Error: Missing required parameters: deptcodes or workdate');
      return NextResponse.json(
        { error: 'รหัสแผนกหรือวันที่ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const deptCodesArray = deptcodesParam.split(',');
    const workDatesArray = workdateParam.split(',');

    console.log('API: Processing deptcodes:', deptCodesArray);
    console.log('API: Processing workdates:', workDatesArray);

    const deptPlaceholders = deptCodesArray.map((_, index) => `$${index + 1}`).join(',');
    const workdatePlaceholders = workDatesArray.map((_, index) => `$${deptCodesArray.length + 1 + index}`).join(',');
    
    const sqlParams = [...deptCodesArray, ...workDatesArray];

    const sql = `
      SELECT
        workdate,
        person_code,
        htcpersoncode,
        deptcode,
        deptname,
        full_name,
        department_full_paths,
        firstscantime,
        lastscantime,
        shiftname,
        "PersonType"
      FROM public.vw_manpower_detail
      WHERE deptcode IN (${deptPlaceholders})
        AND workdate IN (${workdatePlaceholders})
      ORDER BY workdate, full_name
    `;

    console.log('API: Executing SQL query with params:', sqlParams);
    console.log(`API: SQL Query: ${sql}`);

    const result = await db.query(sql, sqlParams);

    console.log('API: Query executed successfully');

    const dataByDate: Record<string, Detail[]> = {};
    // แก้ไข: ระบุชนิดของ 'row' ให้ชัดเจนเพื่อแก้ไข Type Error
    // (Fix: Explicitly type 'row' to resolve the Type Error)
    result.rows.forEach((row: Detail) => {
      if (!dataByDate[row.workdate]) {
        dataByDate[row.workdate] = [];
      }
      dataByDate[row.workdate].push(row);
    });

    const deptName = result.rows.length > 0 ? result.rows[0].deptname : 'ไม่พบชื่อแผนก';

    console.log(`API: Found ${result.rows.length} records`);

    return NextResponse.json(
      {
        deptname: deptName,
        dataByDate: dataByDate,
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
