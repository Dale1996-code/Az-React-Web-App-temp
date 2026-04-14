import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Coaching — create and review coaching records.
 * Fields: employee, date, issue checkboxes, goals, follow-up date, acknowledgement text.
 * Implemented in Phase 6.
 */
const CoachingPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Coaching</Text>
                <Text variant="medium" block>Create and review employee coaching records.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Issue checkboxes · Goals · Follow-up date · Acknowledgement text
                    — coming in Phase 6.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default CoachingPage;
