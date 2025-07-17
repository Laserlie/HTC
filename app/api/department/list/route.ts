import db from '@/services/db';

type Employee = {
    id: string;
    name: string;
    wecom_id: string;
    is_hod?: boolean; // จะกำหนดค่าจาก PersonGroup === 'Management'
};

type DepartmentSummary = {
    id: string;
    name: string;
    employees: Employee[];
};

export async function GET() {
    try {
        console.log('--- เริ่ม query vw_manpower_detail with PersonGroup ---');
        // ดึงข้อมูลจาก view 'public.vw_manpower_detail'
        // *** แก้ไขตรงนี้: ใส่ double quotes ครอบ "PersonGroup" ***
        const result = await db.query('SELECT deptcode, deptname, full_name, person_code, wecom_user_id, "PersonGroup" FROM public.vw_manpower_detail'); // <--- แก้ตรงนี้
        console.log('query result (first 5 rows):', result.rows.slice(0, 5));

        const grouped: Record<string, DepartmentSummary> = {};

        for (const row of result.rows) {
            const departmentId = row.deptcode;
            const departmentName = row.deptname;
            const employeeId = row.person_code;
            const employeeName = row.full_name;
            const wecomId = row.wecom_user_id || '';
            // ตรวจสอบว่า PersonGroup เป็น 'Management' เพื่อระบุว่าเป็น HOD
            const isHod = row.PersonGroup === 'Management'; // *** ใช้ PersonGroup ตรงนี้ ***

            if (!grouped[departmentId]) {
                grouped[departmentId] = {
                    id: departmentId,
                    name: departmentName,
                    employees: [],
                };
            }

            if (employeeId) {
                const existingEmployee = grouped[departmentId].employees.find(e => e.id === employeeId);
                if (!existingEmployee) {
                    grouped[departmentId].employees.push({
                        id: employeeId,
                        name: employeeName,
                        wecom_id: wecomId,
                        is_hod: isHod, // *** ส่งค่า is_hod ไปยัง Frontend ***
                    });
                }
            }
        }
        console.log('grouped departments with WeCom IDs and is_hod:', grouped);
        return Response.json(Object.values(grouped));
    } catch (err) {
        console.error('Error fetching department data from vw_manpower_detail:', err);
        return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
            status: 500,
        });
    }
}