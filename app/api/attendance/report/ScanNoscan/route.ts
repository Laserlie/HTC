// app/api/attendance/report/ScanNoscan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/services/db'; // Import named 'query' function

export async function GET(req: NextRequest) {
  try {
    console.log('API: Start processing request');
    const { searchParams } = new URL(req.url);
    const deptcode = searchParams.get('deptcode');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Get current date in YYYY-MM-DD format based on current location
    // Using 'en-CA' locale for YYYY-MM-DD format consistency
    const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // Set default values for 'from' and 'to' if not provided or invalid
    const finalFrom = from && from !== 'null' && from !== 'undefined' ? from : today;
    const finalTo = to && to !== 'null' && to !== 'undefined' ? to : finalFrom;

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
      WHERE workdate BETWEEN $1 AND $2
        AND person_code IS NOT NULL         -- <--- Added: Filter out NULL person_code
        AND person_code != ''               -- <--- Added: Filter out empty string person_code
    `;
    const queryParams: (string | null)[] = [finalFrom, finalTo];

    // Initialize deptname for the report summary
    let finalDeptName = 'ภาพรวมทั้งหมด';

    // Add deptcode filter if provided and not 'all'
    if (deptcode && deptcode.toLowerCase() !== 'all' && deptcode !== '' && deptcode !== 'undefined' && deptcode !== 'null') {
      sql += ` AND deptcode = $3`;
      queryParams.push(deptcode);
      finalDeptName = ''; // Will be set from query result if specific deptcode
    }

    // ORDER BY clause: Order by deptcode first, then workdate, then full_name
    sql += ` ORDER BY deptcode, workdate, full_name`; // <--- Adjusted here for deptcode sorting

    console.log(`API: Executing SQL with params: from=${finalFrom}, to=${finalTo}, deptcode=${deptcode || 'N/A (all)'}`);
    console.log(`API: SQL Query: ${sql}`);
    console.log(`API: Query Params: ${queryParams}`);

    const result = await query(sql, queryParams); // Using the named 'query' function

    console.log('API: Query executed successfully');

    // Set actual deptname from the first row if a specific deptcode was filtered
    if (deptcode && deptcode.toLowerCase() !== 'all' && result.rows.length > 0) {
      finalDeptName = result.rows[0].deptname;
    }

    console.log(`API: Found ${result.rows.length} records.`);

    return NextResponse.json(
      {
        deptname: finalDeptName,
        detil: result.rows,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('API Error: attendance/report/ScanNoscan:', err);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในฝั่งเซิร์ฟเวอร์' },
      { status: 500 }
    );
  }
}