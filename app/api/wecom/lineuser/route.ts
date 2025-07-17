// D:\สหกิจ\facescan\HTC\app\api\wecom\lineuser\route.ts

import axios from 'axios';
import { NextResponse } from 'next/server';

const BACKEND_LINE_USERS_URL = "http://10.35.10.47:2007/api/LineUsers";

// GET Handler สำหรับดึงข้อมูล LineUser ทั้งหมด (Path: /api/wecom/lineuser)
export async function GET(req: Request) {
    try {
        const response = await axios.get(BACKEND_LINE_USERS_URL);
        return NextResponse.json(response.data, { status: response.status });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error in LineUser proxy (GET all):`, error.message);
            return NextResponse.json({
                message: `Failed to fetch all Line Users via proxy`,
                details: error.response?.data || error.message,
            }, { status: error.response?.status || 500 });
        } else {
            console.error('Unexpected error in LineUser proxy (GET all):', error);
            return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }
    }
}

// POST Handler สำหรับสร้าง LineUser ใหม่ (Path: /api/wecom/lineuser)
export async function POST(req: Request) {
    try {
        const body = await req.json();
        // Backend API คาดหวัง 'id' ใน payload ด้วย แม้จะเป็นการสร้างใหม่ (มักจะส่งเป็น 0 หรือ null)
        // เพิ่มการตรวจสอบความถูกต้องที่แข็งแกร่งยิ่งขึ้นสำหรับฟิลด์ที่จำเป็นทั้งหมดตาม LineUser interface ของคุณ หากจำเป็น
        if (!body || typeof body.employeeCode !== 'string' || typeof body.weComId !== 'string' || typeof body.id === 'undefined') {
            return NextResponse.json({ message: 'Invalid request body for POST. Expected { id, employeeCode, weComId, ... }.' }, { status: 400 });
        }

        const response = await axios.post(BACKEND_LINE_USERS_URL, body);
        return NextResponse.json(response.data, { status: response.status });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(`Error in LineUser proxy (POST):`, error.message);
            return NextResponse.json({
                message: `Failed to create Line User via proxy`,
                details: error.response?.data || error.message,
            }, { status: error.response?.status || 500 });
        } else {
            console.error('Unexpected error in LineUser proxy (POST):', error);
            return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }
    }
}