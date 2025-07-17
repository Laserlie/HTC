import { NextResponse } from 'next/server';
import axios from 'axios';

const BACKEND_EMPLOYEE_ACTIVE_URL = "http://10.35.10.47:2007/api/LineNotify/EmployeeActive";

export async function GET(req: Request) {
    // `req` is part of the Next.js API route signature, even if not directly used in this specific implementation.
    // We explicitly mark it as used to satisfy the linter.
    void req;

    try {
        console.log(`Proxying GET request to: ${BACKEND_EMPLOYEE_ACTIVE_URL}`);
        const response = await axios.get(BACKEND_EMPLOYEE_ACTIVE_URL);
        console.log(`Received response from backend (EmployeeActive): Status ${response.status}`);
        return NextResponse.json(response.data, { status: response.status });
    } catch (error: unknown) { // Changed to unknown for better type safety
        if (axios.isAxiosError(error)) {
            console.error(`Error in EmployeeActive proxy (GET):`, error.message);
            console.error(`Backend Response Data:`, error.response?.data);
            console.error(`Backend Response Status:`, error.response?.status);

            // ส่งข้อความแสดงข้อผิดพลาดที่ให้ข้อมูลมากขึ้นไปยัง Frontend
            return NextResponse.json({
                message: `Failed to fetch Employee Active data via proxy. Please check backend server at ${BACKEND_EMPLOYEE_ACTIVE_URL}.`,
                details: error.response?.data || error.message,
            }, { status: error.response?.status || 500 });
        } else {
            console.error('Unexpected error in EmployeeActive proxy (GET):', error);
            return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
        }
    }
}
