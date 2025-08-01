import axios from 'axios';
import { NextResponse } from 'next/server';

const BACKEND_LINE_USERS_URL = "http://10.35.10.47:2007/api/LineUsers";

// GET Handler สำหรับดึงข้อมูล LineUser ด้วย ID
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in GET request.' }, { status: 400 });
  }

  try {
    const response = await axios.get(`${BACKEND_LINE_USERS_URL}/${id}`);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
        console.error(`Error in LineUser proxy (GET by ID):`, error.message);
        return NextResponse.json({
            message: `Failed to fetch Line User with ID ${id} via proxy`,
            details: error.response?.data || error.message,
        }, { status: error.response?.status || 500 });
    } else {
        console.error('Unexpected error in LineUser proxy (GET by ID):', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  }
}

// PUT Handler สำหรับอัปเดต LineUser ด้วย ID
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in PUT request.' }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (!body || Number(body.id) !== Number(id)) {
      return NextResponse.json({ message: 'body.id must match URL id.' }, { status: 400 });
    }

    const response = await axios.put(`${BACKEND_LINE_USERS_URL}/${id}`, body);

    // ตรวจสอบสถานะ 204 No Content โดยเฉพาะ
    if (response.status === 204) {
      console.info(`PUT request to ${BACKEND_LINE_USERS_URL}/${id} succeeded with 204 No Content.`);
      // ส่ง Response กลับโดยไม่มี body
      return new NextResponse(null, { status: 204 });
    }

    // สำหรับสถานะอื่นๆ ที่คาดหวัง body
    return NextResponse.json(response.data, { status: response.status });

  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
        console.error(`Error in LineUser proxy (PUT):`, error.message);
        // หาก backend ส่งสถานะเป็น 204 แต่ Axios ถือว่าเป็น error (ซึ่งไม่ควรเกิด)
        if (error.response?.status === 204) {
            return new NextResponse(null, { status: 204 });
        }
        return NextResponse.json({
            message: `Failed to update Line User with ID ${id} via proxy`,
            details: error.response?.data || error.message,
        }, { status: error.response?.status || 500 });
    } else {
        console.error('Unexpected error in LineUser proxy (PUT):', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  }
}

// DELETE Handler สำหรับลบ LineUser ด้วย ID
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in DELETE request.' }, { status: 400 });
  }

  try {
    const response = await axios.delete(`${BACKEND_LINE_USERS_URL}/${id}`);
    
    if (response.status === 204) {
        console.info(`DELETE request to ${BACKEND_LINE_USERS_URL}/${id} succeeded with 204 No Content.`);
        return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({ message: 'Deleted successfully', data: response.data }, { status: response.status });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
        console.error(`Error in LineUser proxy (DELETE):`, error.message);
        if (error.response?.status === 204) {
             return new NextResponse(null, { status: 204 });
        }
        return NextResponse.json({
            message: `Failed to delete Line User with ID ${id} via proxy`,
            details: error.response?.data || error.message,
        }, { status: error.response?.status || 500 });
    } else {
        console.error('Unexpected error in LineUser proxy (DELETE):', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
  }
}