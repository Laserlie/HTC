"use client";

import React, { useState, useMemo, useEffect } from 'react';
import Config from '../Config.json'


interface EmployeeHoursApiRawData {
    div: string;
    deptcode: string;
    full_name: string;
    sec: string;
    empid: string;
    w1: number;
    w2: number;
    w3: number;
    w4: number;
    w5: number;
    current_date_use_hour: number;
    hours_left: number;
}


interface Employee {
    id: string;
    name: string;
    department: string;
    departmentName: string;
    deptCode: string;
    hours: number[];
    currentUsedHours: number;
    hoursLeft: number;
}

// Helper function to parse department code string
const parseDeptCode = (deptCode: string) => {
    if (deptCode?.length !== 8) {
        return { factory: '', division: '', department: '', subUnit: '' };
    }
    const factory = deptCode.substring(0, 2);
    const division = deptCode.substring(2, 4);
    const department = deptCode.substring(4, 6);
    const subUnit = deptCode.substring(6, 8);
    return { factory, division, department, subUnit };
};
const Report2: React.FC = () => {

    const today = new Date();
    const [dateTimeFil, setDateTimeFil] = useState({
        month: today.getMonth() + 1,
        year: today.getFullYear()
    });
    const [searchTermInput, setSearchTermInput] = useState<string>('');
    const [statusFilterInput, setStatusFilterInput] = useState<string>('');
    const [factoryFilterInput, setFactoryFilterInput] = useState<string>('');
    const [divisionFilterInput, setDivisionFilterInput] = useState<string>('');
    const [departmentFilterInput, setDepartmentFilterInput] = useState<string>('');
    const [weekFilterInput, setWeekFilterInput] = useState<number>(0);


    const [activeSearchTerm, setActiveSearchTerm] = useState<string>('');
    const [activeStatusFilter, setActiveStatusFilter] = useState<string>('');
    const [activeFactoryFilter, setActiveFactoryFilter] = useState<string>('');
    const [activeDivisionFilter, setActiveDivisionFilter] = useState<string>('');
    const [activeDepartmentFilter, setActiveDepartmentFilter] = useState<string>('');
    const [activeWeekFilter, setActiveWeekFilter] = useState<number>(0);
    // State for pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(20);
    // State for fetched employee data
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);
    //
    const [visibleWeeks, setVisibleWeeks] = useState<number[]>([]);
    const [activeDateTimeFil, setActiveDateTimeFil] = useState({
        month: today.getMonth() + 1,
        year: today.getFullYear()
    });
    const getDataEmployeeHour = async (month: number, year: number) => {
        setLoadingData(true);
        const yearData = Config[year.toString() as keyof typeof Config];
        if (!yearData) {
            console.error('No config data found for the selected year');
            setVisibleWeeks([]);
            setAllEmployees([]);
            setLoadingData(false);
            return;
        }

        const monthData = yearData.mount[month.toString() as keyof typeof Config["2025"]["mount"]];
        if (!monthData) {
            console.error('No config data found for the selected month');
            setVisibleWeeks([]);
            setAllEmployees([]);
            setLoadingData(false);
            return;
        }

        const week = monthData.data_week;
        console.log(week)
        await fetch(`http://10.35.10.47:2007/api/LineUsers/GetEmployeeHours?month=${month}&year=${year}&W1=${week.W1}&W2=${week.W2}&W3=${week.W3}&W4=${week.W4}&W5=${week.W5}`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then((hoursData: EmployeeHoursApiRawData[]) => {

                if (Array.isArray(hoursData)) {
                    const formattedEmployees: Employee[] = hoursData.map(hoursItem => {
                        const deptCode = hoursItem.deptcode || '00000000';
                        return {

                            id: hoursItem.empid,
                            name: hoursItem.full_name || hoursItem.empid,
                            department: hoursItem.div,

                            departmentName: hoursItem.div,
                            deptCode: deptCode,
                            // แก้ไข: สร้างอาร์เรย์ hours ให้มั่นใจว่ามีข้อมูล w1-w5 ครบถ้วน
                            hours: [
                                hoursItem.w1 || 0,
                                hoursItem.w2 || 0,
                                hoursItem.w3 || 0,
                                hoursItem.w4 || 0,
                                hoursItem.w5 || 0
                            ],
                            currentUsedHours: hoursItem.current_date_use_hour,
                            hoursLeft: hoursItem.hours_left,
                        };
                    });
                    setAllEmployees(formattedEmployees);
                } else {
                    console.warn('Invalid data format: Data is not an Array');
                    setAllEmployees([]);
                }
            })
            .catch(err => {
                console.error('An error occurred while retrieving data:', err);
                setAllEmployees([]);
            })
            .finally(() => {

                setLoadingData(false);
            });
    }

    useEffect(() => {
        getDataEmployeeHour(dateTimeFil.month, dateTimeFil.year);
    }, []); // The empty array [] ensures this effect runs only on mount.


    useEffect(() => {
        // Find the week data for the selected month and year
        const yearData = Config[activeDateTimeFil.year.toString() as keyof typeof Config];
        if (yearData) {
            const mount = yearData.mount as Record<string, { data_week: { W1: string; W2: string; W3: string; W4: string; W5: string; } }>;
            const monthData = mount[activeDateTimeFil.month.toString()];
            if (monthData) {
                const dataWeek = monthData.data_week;
                const weeks = [];
                if (dataWeek.W1 !== '0') weeks.push(1);
                if (dataWeek.W2 !== '0') weeks.push(2);
                if (dataWeek.W3 !== '0') weeks.push(3);
                if (dataWeek.W4 !== '0') weeks.push(4);
                if (dataWeek.W5 !== '0') weeks.push(5);
                setVisibleWeeks(weeks);
            } else {
                setVisibleWeeks([]);
            }
        }
    }, [activeDateTimeFil.month, activeDateTimeFil.year]);
    // New handler for the "Search" button click
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setActiveSearchTerm(searchTermInput);
        setActiveStatusFilter(statusFilterInput);
        setActiveFactoryFilter(factoryFilterInput);
        setActiveDivisionFilter(divisionFilterInput);
        setActiveDepartmentFilter(departmentFilterInput);
        setActiveWeekFilter(weekFilterInput);
        setActiveDateTimeFil(dateTimeFil);
        getDataEmployeeHour(dateTimeFil.month, dateTimeFil.year);

        setCurrentPage(1);
    };
    const filteredEmployees = useMemo(() => {
        const filtered = allEmployees.filter(employee => {
            const matchesSearch = employee.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
                employee.id.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
                employee.deptCode.toLowerCase().includes(activeSearchTerm.toLowerCase());

            let matchesStatus = true;
            const weekIndex = activeWeekFilter - 1;


            if (activeStatusFilter === 'overtime' && activeWeekFilter > 0) {
                const hour = employee.hours[weekIndex] || 0;
                matchesStatus = hour > 60;
            } else if (activeStatusFilter === 'normal' && activeWeekFilter > 0) {

                const hour = employee.hours[weekIndex] || 0;
                matchesStatus = hour <= 60;
            } else if (activeStatusFilter === 'overtime' && activeWeekFilter === 0) {
                matchesStatus = employee.hours.some(hour => hour > 60);
            } else if (activeStatusFilter === 'normal' && activeWeekFilter === 0) {
                matchesStatus = employee.hours.every(hour => hour <= 60);
            }

            const { factory, division } = parseDeptCode(employee.deptCode);
            const matchesFactory = !activeFactoryFilter || (factory === activeFactoryFilter);
            const matchesDivision = !activeDivisionFilter || (division === activeDivisionFilter);
            const matchesDepartment = !activeDepartmentFilter || (employee.deptCode === activeDepartmentFilter);

            return matchesSearch && matchesStatus && matchesFactory && matchesDivision && matchesDepartment;
        });
        return filtered.sort((a, b) => a.deptCode.localeCompare(b.deptCode));
    }, [activeSearchTerm, activeStatusFilter, activeFactoryFilter, activeDivisionFilter, activeDepartmentFilter, allEmployees, activeWeekFilter]);
    // Memoized unique options for each dropdown
    const factoryOptions = useMemo(() => {
        const options = new Map<string, string>();
        allEmployees.forEach(emp => {
            const { factory } = parseDeptCode(emp.deptCode);
            if (factory && !options.has(factory)) {
                options.set(factory, emp.departmentName);


            }
        });
        return Array.from(options.entries()).map(([code, name]) => ({ code, name }));
    }, [allEmployees]);
    const divisionOptions = useMemo(() => {
        const options = new Map<string, string>();
        allEmployees.forEach(emp => {
            const { factory, division } = parseDeptCode(emp.deptCode);
            if (factory === factoryFilterInput && division && division !== '00' && !options.has(division)) {
                options.set(division, emp.departmentName);


            }
        });
        return Array.from(options.entries()).map(([code, name]) => ({ code, name }));
    }, [allEmployees, factoryFilterInput]);
    const departmentOptions = useMemo(() => {
        const uniqueDepartments = new Map<string, { code: string; name: string }>();
        allEmployees.forEach(emp => {
            const { factory, division } = parseDeptCode(emp.deptCode);
            if (factory === factoryFilterInput && division === divisionFilterInput && emp.departmentName) {
                uniqueDepartments.set(emp.deptCode, { code: emp.deptCode, name: emp.departmentName });


            }
        });
        return Array.from(uniqueDepartments.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allEmployees, factoryFilterInput, divisionFilterInput]);
    // Memoized paginated data to display
    const paginatedEmployees = useMemo(() => {
        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        return filteredEmployees.slice(indexOfFirstRow, indexOfLastRow);
    }, [filteredEmployees, currentPage, rowsPerPage]);
    const summaryData = useMemo(() => {
        let normalEmployees = 0;
        let overtimeEmployees = 0;

        if (activeStatusFilter === 'normal') {
            normalEmployees = filteredEmployees.length;
        } else if (activeStatusFilter === 'overtime') {
            overtimeEmployees = filteredEmployees.length;
        } else {


            if (activeWeekFilter > 0) {
                const weekIndex = activeWeekFilter - 1;
                overtimeEmployees = filteredEmployees.filter(emp => (emp.hours[weekIndex] || 0) > 60).length;
            } else {
                overtimeEmployees = filteredEmployees.filter(emp => emp.hours.some(h => h > 60)).length;


            }
            normalEmployees = filteredEmployees.length - overtimeEmployees;
        }

        return { totalEmployees: allEmployees.length, normalEmployees, overtimeEmployees };
    }, [filteredEmployees, activeStatusFilter, activeWeekFilter, allEmployees]);
    // ---

    const handleExportToCSV = () => {
        // Dynamic headers based on weekFilter
        let headers = ['WorkdayID', 'deptcode', 'Name-Lastname', 'Department'];
        if (activeWeekFilter === 0) {
            headers = [...headers, ...visibleWeeks.map(w => `Week${w}`), 'Worked for (Latest Week)', 'Working hours remaining (Latest Week)'];
        } else {
            headers = [...headers, `Week ${activeWeekFilter}`, 'Worked for', 'Working hours remaining'];
        }

        const csvContent = [
            headers.join(','),
            ...filteredEmployees.map(emp => {
                let rowData = [
                    emp.id,
                    `"${emp.deptCode}"`,


                    `"${emp.name}"`,
                    `"${emp.departmentName}"`,

                ];
                if (activeWeekFilter === 0) {
                    // Export all weeks if no specific week is filtered
                    const latestWeekIndex = emp.hours.length - 1 - [...emp.hours].reverse().findIndex(hour => hour > 0);
                    const latestUsedHours = latestWeekIndex !== -1 ? (emp.hours[latestWeekIndex] || 0) : 0;
                    const hoursLeftCalculated = 60 - latestUsedHours; // Assuming 60 hours is the maximum


                    // Map only the hours for visible weeks
                    const visibleHours = visibleWeeks.map(w => emp.hours[w - 1] || 0);
                    rowData = [...rowData, ...visibleHours.map(String), String(latestUsedHours), String(hoursLeftCalculated)];
                } else {
                    // Export only the selected week's data
                    const selectedWeekHours = emp.hours[activeWeekFilter - 1] || 0;
                    const hoursLeftCalculated = 60 - selectedWeekHours;
                    rowData = [...rowData, String(selectedWeekHours), String(selectedWeekHours), String(hoursLeftCalculated)];
                }
                return rowData.join(',');
            })
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'WorkAttendanceReport_week.csv');
        document.body.appendChild(link);
        link.click();
        document.body.appendChild(link);
    }; 
    // Handlers for pagination
    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // New helper to format the month name in Thai
    const getMountName = (month: number) => {
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return monthNames[month - 1];
    };

    return (
        <div className="container mx-auto px-4 py-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-5">
                <div className="flex items-center justify-between">
                    <div>

                        <h1 className="text-3xl font-bold text-gray-700 mb-2 ">Weekly employee work report for {getMountName(dateTimeFil.month)} {dateTimeFil.year}</h1>
                        <p className="text-gray-600">Working hours - Weekly</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 flex-wrap">
                    <input
                        type="text"

                        placeholder="Search by name, employee code or deptcode..."
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2  focus:ring-blue-500 flex-grow shadow-md "
                        value={searchTermInput}

                        onChange={(e) => setSearchTermInput(e.target.value)}
                    />
                    <select
                        id="statusFilter"


                        value={statusFilterInput}

                        onChange={(e) => setStatusFilterInput(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-md"
                    >
                        <option value="">All Status</option>

                        <option value="normal">Normal (≤ 60 hrs)</option>
                        <option value="overtime">Overtime ( &gt; 60 hrs)</option>
                    </select>
                    <select


                        id="monthFilter"
                        value={dateTimeFil.month}
                        onChange={e =>
                            setDateTimeFil(prev => ({

                                ...prev,
                                month: Number(e.target.value)
                            }))

                        }
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-md"
                    >
                        <option value={today.getMonth() + 1}>Latest Month</option>


                        <option value={1}>January</option>
                        <option value={2}>February</option>
                        <option value={3}>March</option>
                        <option value={4}>April</option>

                        <option value={5}>May</option>
                        <option value={6}>June</option>
                        <option value={7}>July</option>
                        <option value={8}>August</option>

                        <option value={9}>September</option>
                        <option value={10}>October</option>
                        <option value={11}>November</option>
                        <option value={12}>December</option>

                    </select>

                    {/* Week Filter Dropdown */}
                    <select
                        id="weekFilter"

                        value={weekFilterInput}
                        onChange={e => setWeekFilterInput(Number(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-md"
                    >
                        <option value={0}>All Weeks</option>
                        {visibleWeeks.map((weekNum) => (
                            <option key={weekNum} value={weekNum}>
                                Week {weekNum}
                            </option>
                        ))}
                    </select>

                    <select
                        id="yearFilter"
                        value={dateTimeFil.year}

                        onChange={e =>

                            setDateTimeFil(prev => ({
                                ...prev,
                                year: Number(e.target.value)

                            }))
                        }
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 shadow-md"
                    >

                        <option value={today.getFullYear()}>Latest Year</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                        <option value={2028}>2028</option>
                        <option value={2029}>2029</option>
                        <option value={2030}>2030</option>
                        <option value={2031}>2031</option>
                        <option value={2032}>2032</option>
                        <option value={2033}>2033</option>
                        <option value={2034}>2034</option>
                        <option value={2035}>2035</option>

                    </select>
                    {/* Updated Factory dropdown to show names */}
                    <select
                        value={factoryFilterInput}
                        onChange={(e) => {
                            setFactoryFilterInput(e.target.value);
                            setDivisionFilterInput('');
                            setDepartmentFilterInput('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-md"
                    >
                        <option value="">All Factories</option>

                        {factoryOptions.map(option => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                    </select>
                    {/* Updated Division dropdown to show names */}
                    <select
                        id="divisionFilter"
                        value={divisionFilterInput}
                        onChange={(e) => {

                            setDivisionFilterInput(e.target.value);
                            setDepartmentFilterInput('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-md"
                        disabled={!factoryFilterInput}
                    >

                        <option value="">All Divisions</option>
                        {divisionOptions.map(option => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}

                    </select>
                    {/* The department filter is updated to ensure unique names */}
                    <select
                        id="departmentFilter"
                        value={departmentFilterInput}

                        onChange={(e) => setDepartmentFilterInput(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-md"
                        disabled={!divisionFilterInput}

                    >
                        <option value="">All Departments</option>
                        {departmentOptions.map((option, idx) => (
                            <option key={`${option.code}-${idx}`} value={option.code}>{option.name}</option>

                        ))}
                    </select>

                    <button
                        type="submit"
                        className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-900 flex items-center justify-center min-w-[100px] shadow-lg"
                        disabled={loadingData}
                    >
                        Search
                        <svg xmlns="http://www.w3.org/2000/svg"

                            className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

                        </svg>
                    </button>
                </form>
            </div>

            {/* Summary Cards */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                {/*Card 1: Total Employees */}
                <div className="bg-blue-100 rounded-xl shadow-md p-6 ">
                    <div className="flex items-center">
                        <div className="p-3 bg-blue-200 rounded-full  ">

                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-blue-800">All employees</p>
                            <p className="text-3xl font-bold text-blue-800">{allEmployees.length} people</p>
                        </div>

                    </div>
                </div>

                {/*Card 2: Normal Employees */}
                <div className="bg-green-100 rounded-xl shadow-md p-6">
                    <div className="flex items-center">
                        <div className="p-3 bg-green-100 rounded-full">

                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>

                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-green-800">normal (≤ 60 hrs.)</p>

                            <p className="text-3xl font-bold text-green-700">{summaryData.normalEmployees} people</p>
                        </div>
                    </div>
                </div>
                {/* Card 3: Overtime Employees */}

                <div className="bg-red-100 rounded-xl shadow-md p-6 ">
                    <div className="flex items-center">
                        <div className="p-3 bg-red-100 rounded-full">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                        </div>

                        <div className="ml-4">
                            <p className="text-sm text-red-500">More than 60 hrs.</p>
                            <p className="text-3xl font-bold text-red-600">{summaryData.overtimeEmployees} people</p>
                        </div>
                    </div>
                </div>

            </div>


            {loadingData && (
                <div className="p-8 text-center text-gray-500">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>


                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0
3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p>Loading data...</p>

                </div>
            )}

            {/* Employee Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-blue-700 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">Details of working hours per week</h2>


                    {/* Rows per page dropdown moved here */}
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-white">Show </span>
                        <select

                            value={rowsPerPage}
                            onChange={handleRowsPerPageChange}
                            className="px-3 py-1 border rounded-lg bg-white text-gray-900"

                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={40}>50</option>

                            <option value={100}>100</option>
                            <option value={filteredEmployees.length}>All</option>
                        </select>
                    </div>

                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100">

                            <tr>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600  tracking-wider w-1/12">Deptcode</th>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600  tracking-wider w-1/12">WorkdayIDs</th>

                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600  tracking-wider w-2/12">department</th>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600  tracking-wider w-2/12">Name-Lastname</th>
                                {visibleWeeks.map((weekNum) => (
                                    <th
                                        key={`week-header-${weekNum}`}


                                        className={`px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${activeWeekFilter === weekNum ? 'bg-indigo-100' : ''}`}
                                    >
                                        Week {weekNum}

                                    </th>
                                ))}
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500  tracking-wider">

                                    Worked for <br /> ({activeWeekFilter === 0 ? 'Last Week' : `Week ${activeWeekFilter}`})
                                </th>
                                <th
                                    className="px-6 py-3 text-center text-xs font-medium text-gray-500  tracking-wider">
                                    working hours remaining <br /> ({activeWeekFilter === 0 ? 'Last Week' : `Week ${activeWeekFilter}`})
                                </th>

                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedEmployees.length > 0 ? (
                                paginatedEmployees.map(employee => {
                                    // Logic to find the latest week or use the filtered week


                                    const latestWeekIndex = activeWeekFilter > 0 ? activeWeekFilter - 1 : employee.hours.length - 1 - [...employee.hours].reverse().findIndex(hour => hour > 0);
                                    const latestUsedHours = latestWeekIndex !== -1 ? (employee.hours[latestWeekIndex] || 0) : 0;


                                    const hoursLeftCalculated = 60 - latestUsedHours; // Assuming 60 hours is the maximum

                                    return (

                                        <tr key={employee.id} className={'hover:bg-gray-50'}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 w-2/12">{employee.deptCode}</td>


                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-1/12">{employee.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 w-2/12">{employee.departmentName}</td>


                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-2/12">{employee.name}</td>
                                            {visibleWeeks.map((weekNum) => {
                                                const index = weekNum - 1;
                                                const hour = employee.hours[index] || 0;
                                                let cellColorClass = 'text-gray-900';
                                                if (hour > 60) {
                                                    cellColorClass = 'text-red-600 font-semibold';
                                                } else if (hour <= 60 && hour > 0) {
                                                    cellColorClass = 'text-green-600';
                                                } else if (hour === 0) {
                                                    cellColorClass = 'text-black';
                                                }

                                                // Highlight the cell if it's the selected week


                                                const highlightClass = activeWeekFilter === weekNum ? 'bg-indigo-50' : '';
                                                return (
                                                    <td key={index} className={`px-6 py-4 whitespace-nowrap text-sm text-center ${cellColorClass} ${highlightClass}`}>


                                                        {hour == null ? 0 : hour}
                                                    </td>


                                                );
                                            })}
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${latestUsedHours > 60 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>{latestUsedHours == null ? 0 : latestUsedHours}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{hoursLeftCalculated == null ? 0 : hoursLeftCalculated}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10}
                                        className="text-center py-8 text-gray-500">Employee information not found</td>
                                </tr>
                            )}
                        </tbody>

                    </table>
                </div>

                {/* Page navigation buttons - remain at the bottom */}
                <div className="flex justify-end items-center bg-gray-100 p-4 ">
                    <div className="flex items-center space-x-2">

                        <span className="text-sm text-gray-700">Page {currentPage} from {Math.ceil(filteredEmployees.length / rowsPerPage)}</span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}

                            disabled={currentPage === 1}
                            className="px-3 py-1 border rounded-lg disabled:opacity-50 shadow-sm"
                        >
                            Previous

                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}

                            disabled={currentPage >= Math.ceil(filteredEmployees.length / rowsPerPage)}
                            className="px-3 py-1 border rounded-lg disabled:opacity-50 shadow-sm"
                        >
                            Next

                        </button>
                    </div>
                </div>

            </div>

            {/* Export Button */}
            <div className="mt-8 text-center">

                <button
                    onClick={handleExportToCSV}
                    className="bg-blue-600 hover:bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition duration-300"
                >
                    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export CSV
                </button>
            </div>
        </div>
    );
};

export default Report2;