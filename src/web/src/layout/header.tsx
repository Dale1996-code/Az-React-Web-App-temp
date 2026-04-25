import { FontIcon, getTheme, IconButton, IIconProps, IStackStyles, mergeStyles, Persona, PersonaSize, Stack, Text } from '@fluentui/react';
import { FC, ReactElement } from 'react';

const theme = getTheme();

const logoStyles: IStackStyles = {
    root: {
        width: '300px',
        background: theme.palette.themePrimary,
        alignItems: 'center',
        padding: '0 20px'
    }
}

const logoIconClass = mergeStyles({
    fontSize: 20,
    paddingRight: 10
});

const toolStackClass: IStackStyles = {
    root: {
        alignItems: 'center',
        height: 48,
        paddingRight: 10
    }
}

const iconProps: IIconProps = {
    styles: {
        root: {
            fontSize: 16,
            color: theme.palette.white
        }
    }
}

type HeaderProps = {
    onToggleSidebar?: () => void;
};

const Header: FC<HeaderProps> = ({ onToggleSidebar }): ReactElement => {
    return (
        <Stack horizontal>
            {/* Hamburger — visible on mobile only via CSS */}
            <Stack.Item className="mobile-menu-btn">
                <IconButton
                    iconProps={{ iconName: 'GlobalNavButton', styles: iconProps.styles }}
                    onClick={onToggleSidebar}
                    ariaLabel="Toggle navigation"
                    styles={{ root: { height: 48, width: 48 } }}
                />
            </Stack.Item>
            <Stack horizontal styles={logoStyles} className="header-logo">
                <FontIcon aria-label="Store" iconName="Store" className={logoIconClass} />
                <Text variant="xLarge">Dales Operations</Text>
            </Stack>
            <Stack.Item grow={1}>
                <div></div>
            </Stack.Item>
            <Stack.Item>
                <Stack horizontal styles={toolStackClass} grow={1}>
                    <Persona size={PersonaSize.size24} text="Shift Lead" />
                </Stack>
            </Stack.Item>
        </Stack>
    );
}

export default Header;
