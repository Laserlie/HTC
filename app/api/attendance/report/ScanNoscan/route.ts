// /api/attendance/report/ScanNoscan/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const deptcode = searchParams.get('deptcode');

    // กำหนดวันที่ปัจจุบัน
    const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    
    // ตั้งค่าช่วงวันที่ให้เป็นวันปัจจุบันเท่านั้น
    const finalFrom = today; 
    const finalTo = today;

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
        AND person_code IS NOT NULL
        AND person_code != ''
    `;
    const queryParams: (string | null)[] = [finalFrom, finalTo];
    
    // เพิ่มเงื่อนไขการกรองตาม deptcode ถ้ามี
    if (deptcode && deptcode !== 'all') {
      sql += ` AND deptcode = $3`;
      queryParams.push(deptcode);
    }

    // เรียกใช้ฟังก์ชัน query
    const result = await query(sql, queryParams);

    // ส่ง Response กลับในทุกกรณี
    if (result.rows.length === 0) {
      return NextResponse.json({ detil: [], message: "No data found" }, { status: 200 });
    }

    return NextResponse.json({ detil: result.rows }, { status: 200 });

  } catch (err) {
    console.error("API Error:", err);
    // ส่ง Response กลับเมื่อเกิดข้อผิดพลาด
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}