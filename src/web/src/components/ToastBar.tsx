import { FC } from 'react';
import { MessageBar, MessageBarType } from '@fluentui/react';

type Props = { message: string | null };

const ToastBar: FC<Props> = ({ message }) => {
    if (!message) return null;
    return (
        <MessageBar
            messageBarType={MessageBarType.success}
            className="toast-bar"
            styles={{
                root: {
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    maxWidth: 320,
                    zIndex: 9999,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: 4,
                },
            }}
        >
            {message}
        </MessageBar>
    );
};

export default ToastBar;
