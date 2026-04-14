import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Employees — create and manage employee profiles.
 * Fields: name, role, department/area, notes.
 * Implemented in Phase 2.
 */
const EmployeesPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Employees</Text>
                <Text variant="medium" block>Create and manage employee profiles.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Name · Role · Department/Area · Notes — coming in Phase 2.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default EmployeesPage;
