import { NextRequest } from 'next/server';
import db from '@/services/db'; 

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const departmentId = searchParams.get('departmentId'); 
    const employeeId = searchParams.get('employeeId'); 

 
    if (!date) {
      return new Response(JSON.stringify({ error: 'Missing date' }), { status: 400 });
    }

    let query = 'SELECT * FROM public.vw_manpower WHERE workdate = $1';
    const values: string[] = [date];
    let index = 2;

    if (departmentId) {
      // *** แก้ไข: ใช้ deptcode ในการกรอง ***
      query += ` AND deptcode = $${index++}`;
      values.push(departmentId);
    }

    if (employeeId) {
      // *** แก้ไข: กรองตามสถานะการสแกน ***
      if (employeeId === 'scanned') {
        query += ` AND countscan > 0`; 
      } else if (employeeId === 'not_scanned') {
        query += ` AND countnotscan > 0`; 
      }
    }

    query += ' ORDER BY deptname ASC';
    console.log('Executing Query:', query); 
    console.log('With values:', values); 

    const result = await db.query(query, values);
    return Response.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch report:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorMessage }), { status: 500 });
  }
}