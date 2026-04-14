import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Issues — quick issue capture and tracking.
 * Fields: type, notes, department, date, status (open/resolved).
 * Implemented in Phase 7.
 */
const IssuesPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Issues</Text>
                <Text variant="medium" block>Log and track shift issues.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Issue type · Notes · Department · Date · Status (Open / Resolved)
                    — coming in Phase 7.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default IssuesPage;
