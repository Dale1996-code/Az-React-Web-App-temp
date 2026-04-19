import { FC } from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';

type Props = {
    message: string | null;
    onDismiss: () => void;
};

const ErrorBar: FC<Props> = ({ message, onDismiss }) => {
    if (!message) return null;
    return (
        <MessageBar
            messageBarType={MessageBarType.error}
            onDismiss={onDismiss}
            dismissButtonAriaLabel="Dismiss"
        >
            {message}
        </MessageBar>
    );
};

export default ErrorBar;
