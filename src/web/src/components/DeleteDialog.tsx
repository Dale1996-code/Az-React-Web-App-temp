import { FC } from 'react';
import {
    DefaultButton,
    Dialog,
    DialogFooter,
    DialogType,
    MessageBar,
    MessageBarType,
    PrimaryButton,
} from '@fluentui/react';

type Props = {
    hidden: boolean;
    title: string;
    subText: string;
    deleting: boolean;
    deleteError: string | null;
    onConfirm: () => void;
    onDismiss: () => void;
};

const DeleteDialog: FC<Props> = ({
    hidden,
    title,
    subText,
    deleting,
    deleteError,
    onConfirm,
    onDismiss,
}) => (
    <Dialog
        hidden={hidden}
        onDismiss={onDismiss}
        dialogContentProps={{ type: DialogType.normal, title, subText }}
        modalProps={{ isBlocking: true }}
    >
        {deleteError && (
            <MessageBar
                messageBarType={MessageBarType.error}
                styles={{ root: { marginBottom: 8 } }}
            >
                {deleteError}
            </MessageBar>
        )}
        <DialogFooter>
            <PrimaryButton
                text={deleting ? 'Removing…' : 'Remove'}
                onClick={onConfirm}
                disabled={deleting}
                styles={{ root: { background: '#a4262c', borderColor: '#a4262c' } }}
            />
            <DefaultButton text="Cancel" onClick={onDismiss} disabled={deleting} />
        </DialogFooter>
    </Dialog>
);

export default DeleteDialog;
