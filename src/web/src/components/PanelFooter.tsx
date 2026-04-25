import { FC } from 'react';
import { DefaultButton, PrimaryButton, Stack } from '@fluentui/react';

type Props = {
    saving: boolean;
    onSave: () => void;
    onCancel: () => void;
    /** When provided, the Save button acts as a submit for the given form id. */
    formId?: string;
};

const PanelFooter: FC<Props> = ({ saving, onSave, onCancel, formId }) => (
    <Stack horizontal tokens={{ childrenGap: 8 }} style={{ padding: '16px 0' }}>
        <PrimaryButton
            text={saving ? 'Saving…' : 'Save'}
            // If formId is set, form onSubmit calls handleSave — avoid double-fire
            onClick={formId ? undefined : onSave}
            type={formId ? 'submit' : 'button'}
            form={formId}
            disabled={saving}
        />
        <DefaultButton text="Cancel" onClick={onCancel} disabled={saving} />
    </Stack>
);

export default PanelFooter;
