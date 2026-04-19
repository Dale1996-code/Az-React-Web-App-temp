import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEmployees } from '../../hooks/useEmployees';

vi.mock('../../services/employeesService', () => ({
    getEmployees: vi.fn(),
}));

import { getEmployees } from '../../services/employeesService';

const mockGetEmployees = vi.mocked(getEmployees);

describe('useEmployees', () => {
    beforeEach(() => {
        mockGetEmployees.mockReset();
    });

    it('starts with empty state and loading true', () => {
        mockGetEmployees.mockResolvedValue([]);
        const { result } = renderHook(() => useEmployees());
        expect(result.current.employees).toEqual([]);
        expect(result.current.employeeMap.size).toBe(0);
        expect(result.current.employeeOptions).toEqual([]);
    });

    it('populates employees, map, and options after loading', async () => {
        const employees = [
            { id: 'e1', firstName: 'Alice', lastName: 'Smith', isActive: true, role: 'Lead', department: 'Grocery' },
            { id: 'e2', firstName: 'Bob',   lastName: 'Jones', isActive: true, role: 'Assoc' },
        ];
        mockGetEmployees.mockResolvedValue(employees);

        const { result } = renderHook(() => useEmployees());

        await waitFor(() => expect(result.current.loadingEmployees).toBe(false));

        expect(result.current.employees).toHaveLength(2);
        expect(result.current.employeeMap.get('e1')?.firstName).toBe('Alice');
        expect(result.current.employeeOptions[0]).toEqual({
            key: 'e1',
            text: 'Alice Smith (Grocery)',
        });
        expect(result.current.employeeOptions[1]).toEqual({
            key: 'e2',
            text: 'Bob Jones',
        });
    });

    it('stays empty gracefully if the API call fails', async () => {
        mockGetEmployees.mockRejectedValue(new Error('network error'));

        const { result } = renderHook(() => useEmployees());

        await waitFor(() => expect(result.current.loadingEmployees).toBe(false));

        expect(result.current.employees).toEqual([]);
        expect(result.current.employeeOptions).toEqual([]);
    });

    it('calls getEmployees with active:true', async () => {
        mockGetEmployees.mockResolvedValue([]);
        renderHook(() => useEmployees());
        expect(mockGetEmployees).toHaveBeenCalledWith({ active: true });
    });
});
