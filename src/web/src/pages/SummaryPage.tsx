import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Daily Summary — save a summary for the shift.
 * Fields: completed work, missed work, follow-up items, general notes.
 * Implemented in Phase 8.
 */
const SummaryPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Daily Summary</Text>
                <Text variant="medium" block>Save a shift summary for the day.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Completed work · Missed work · Follow-up items · General notes
                    — coming in Phase 8.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default SummaryPage;
