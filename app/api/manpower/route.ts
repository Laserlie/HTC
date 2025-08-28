import {NextResponse} from 'next/server';
import db from '@/services/db';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        let query = 'SELECT * FROM public.vw_manpower';
        const params: unknown[] = [];

        if (from && to) {
            query += ' WHERE workdate >= $1 AND workdate <= $2';
            params.push(from, to);
        } else if (from) {
            query += ' WHERE workdate = $1';
            params.push(from);
        } else if (to) {
            query += ' WHERE workdate = $1';
            params.push(to);
        }

        const result = await db.query(query, params);
        return NextResponse.json(result.rows);
    }catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Failed to fetch manpower data '}, {status: 500});
    }
}
