import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Tasks — daily task tracking.
 * Create tasks, assign to employees, track status, group by department.
 * Implemented in Phase 3.
 */
const TasksPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Tasks</Text>
                <Text variant="medium" block>Create and track daily tasks.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Assign tasks · Set status (Not Started / In Progress / Completed) ·
                    Group by department — coming in Phase 3.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default TasksPage;
