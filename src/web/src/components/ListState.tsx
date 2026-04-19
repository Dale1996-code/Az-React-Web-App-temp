import { FC, ReactNode } from 'react';
import { Spinner, SpinnerSize, Stack } from '@fluentui/react';

type Props = {
    loading: boolean;
    loadingLabel: string;
    empty: boolean;
    emptyContent: ReactNode;
    children: ReactNode;
};

const ListState: FC<Props> = ({ loading, loadingLabel, empty, emptyContent, children }) => {
    if (loading) {
        return (
            <Stack horizontalAlign="center" style={{ padding: 40 }}>
                <Spinner size={SpinnerSize.large} label={loadingLabel} />
            </Stack>
        );
    }
    if (empty) {
        return (
            <Stack
                horizontalAlign="center"
                style={{ padding: 40, border: '1px dashed #c8c6c4', borderRadius: 4 }}
            >
                {emptyContent}
            </Stack>
        );
    }
    return (
        <Stack
            styles={{ root: { border: '1px solid #edebe9', borderRadius: 4, overflow: 'hidden' } }}
        >
            {children}
        </Stack>
    );
};

export default ListState;
