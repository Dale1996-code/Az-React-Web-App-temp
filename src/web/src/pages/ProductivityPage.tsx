import { FC, ReactElement } from 'react';
import { Stack, Text } from '@fluentui/react';
import { stackItemPadding, stackPadding } from '../ux/styles';

/**
 * Productivity — daily productivity entries per employee.
 * Tracks freight stocked, break duration, zoned areas, overstock notes, shift notes.
 * Implemented in Phase 5.
 */
const ProductivityPage: FC = (): ReactElement => {
    return (
        <Stack tokens={stackPadding}>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="xxLarge" block>Productivity</Text>
                <Text variant="medium" block>Log daily productivity entries for each employee.</Text>
            </Stack.Item>
            <Stack.Item tokens={stackItemPadding}>
                <Text variant="small">
                    Freight stocked · Break duration · Zoned areas ·
                    Overstock notes · Shift notes — coming in Phase 5.
                </Text>
            </Stack.Item>
        </Stack>
    );
};

export default ProductivityPage;
