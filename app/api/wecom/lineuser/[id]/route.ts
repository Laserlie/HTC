import axios from 'axios';
import { NextResponse } from 'next/server';

const BACKEND_LINE_USERS_URL = "http://10.35.10.47:2007/api/LineUsers";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();  // เพิ่ม trim

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in GET request.' }, { status: 400 });
  }

  try {
    const response = await axios.get(`${BACKEND_LINE_USERS_URL}/${id}`);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    console.error('GET error:', error);
    return NextResponse.json({ message: 'Failed to fetch LineUser by ID' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();  // เพิ่ม trim

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in PUT request.' }, { status: 400 });
  }

  try {
    const body = await req.json();

    if (!body || Number(body.id) !== Number(id)) {
      return NextResponse.json({ message: 'body.id must match URL id.' }, { status: 400 });
    }

    const response = await axios.put(`${BACKEND_LINE_USERS_URL}/${id}`, body);
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    console.error('PUT error:', error);
    return NextResponse.json({ message: 'Failed to update LineUser' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const id = params.id?.trim();  // เพิ่ม trim

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ message: 'Invalid or missing ID in DELETE request.' }, { status: 400 });
  }

  try {
    const response = await axios.delete(`${BACKEND_LINE_USERS_URL}/${id}`);
    return NextResponse.json({ message: 'Deleted successfully', data: response.data }, { status: response.status });
  } catch (error: unknown) {
    console.error('DELETE error:', error);
    return NextResponse.json({ message: 'Failed to delete LineUser' }, { status: 500 });
  }
}
