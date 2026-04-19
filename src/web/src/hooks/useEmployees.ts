import { useEffect, useState } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { Employee } from '../models/employee';
import { getEmployees } from '../services/employeesService';

export function useEmployees() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [employeeMap, setEmployeeMap] = useState<Map<string, Employee>>(new Map());
    const [employeeOptions, setEmployeeOptions] = useState<IDropdownOption[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(false);

    useEffect(() => {
        setLoadingEmployees(true);
        getEmployees({ active: true })
            .then(list => {
                const map = new Map<string, Employee>();
                const opts: IDropdownOption[] = [];
                list.forEach(emp => {
                    map.set(emp.id, emp);
                    opts.push({
                        key: emp.id,
                        text: `${emp.firstName} ${emp.lastName}${emp.department ? ` (${emp.department})` : ''}`,
                    });
                });
                setEmployees(list);
                setEmployeeMap(map);
                setEmployeeOptions(opts);
            })
            .catch(() => {
                // Non-fatal — names/dropdowns fall back gracefully
            })
            .finally(() => {
                setLoadingEmployees(false);
            });
    }, []);

    return { employees, employeeMap, employeeOptions, loadingEmployees };
}
