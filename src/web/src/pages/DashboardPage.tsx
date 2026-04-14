import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Dashboard — today's shift overview.
 * Will show open tasks, completed tasks, open issues, and coaching follow-ups.
 * Implemented in Phase 4.
 */
const DashboardPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Dashboard</Text>
                <Text variant="medium" block>Today's shift overview.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Open tasks · Completed tasks · Open issues · Coaching follow-ups due
                    — coming in Phase 4.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default DashboardPage;
