import { FC } from 'react';
import { DefaultButton, PrimaryButton, Stack } from '@fluentui/react';

type Props = {
    saving: boolean;
    onSave: () => void;
    onCancel: () => void;
};

const PanelFooter: FC<Props> = ({ saving, onSave, onCancel }) => (
    <Stack horizontal tokens={{ childrenGap: 8 }} style={{ padding: '16px 0' }}>
        <PrimaryButton
            text={saving ? 'Saving…' : 'Save'}
            onClick={onSave}
            disabled={saving}
        />
        <DefaultButton text="Cancel" onClick={onCancel} disabled={saving} />
    </Stack>
);

export default PanelFooter;
