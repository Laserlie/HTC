import { NextRequest } from 'next/server';
import db from '@/services/db';

interface SummaryData {
  totalScanned: string;
  totalNotScanned: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const deptCode = searchParams.get('deptCode'); // เพิ่มการรับค่า deptCode
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!date || !dateRegex.test(date)) {
    return new Response(
      JSON.stringify({ error: 'รูปแบบวันที่ไม่ถูกต้องหรือไม่ครบถ้วน โปรดใช้รูปแบบ ปี-เดือน-วัน (yyyy-mm-dd).' }),
      { status: 400 }
    );
  }

  try {
    let queryText = `
      SELECT
          COALESCE(SUM(countscan), 0) AS "totalScanned",      
          COALESCE(SUM(countnotscan), 0) AS "totalNotScanned" 
       FROM
          public.vw_manpower
       WHERE
          workdate = $1
    `;
    const queryParams = [date];

    // เพิ่มการตรวจสอบว่า deptCode มีสองหลักแรกเป็นตัวเลข
    const deptCodeRegex = /^\d{2}/;

    // เพิ่มเงื่อนไขการกรองด้วย deptCode ถ้ามีการส่งค่ามาและตรงตามรูปแบบที่กำหนด
    if (deptCode && deptCodeRegex.test(deptCode)) {
      queryText += ` AND deptcodelevel1 = $2`;
      queryParams.push(deptCode);
    }
    
    queryText += `;`; // ปิดท้าย query

    const result = await db.query(queryText, queryParams);

    const rawSummary = result.rows[0] as SummaryData || {};

    const summary = {
      totalScanned: parseInt(rawSummary.totalScanned || '0', 10),
      totalNotScanned: parseInt(rawSummary.totalNotScanned || '0', 10),
    };

    return Response.json(summary);

  } catch (err: unknown) {
    console.error('Error fetching attendance summary from vw_manpower:', err);

    if (err instanceof Error) {
      return new Response(
        JSON.stringify({ error: `เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: ${err.message}` }),
        { status: 500 }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์ขณะดึงข้อมูลสรุปการเข้างานจาก vw_manpower' }),
        { status: 500 }
      );
    }
  }
}
