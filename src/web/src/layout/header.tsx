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

const Header: FC = (): ReactElement => {
    return (
        <Stack horizontal>
            <Stack horizontal styles={logoStyles}>
                <FontIcon aria-label="Store" iconName="Store" className={logoIconClass} />
                <Text variant="xLarge">Dales Operations</Text>
            </Stack>
            <Stack.Item grow={1}>
                <div></div>
            </Stack.Item>
            <Stack.Item>
                <Stack horizontal styles={toolStackClass} grow={1}>
                    <IconButton aria-label="Settings" iconProps={{ iconName: 'Settings', ...iconProps }} />
                    <IconButton aria-label="Help" iconProps={{ iconName: 'Help', ...iconProps }} />
                    <Persona size={PersonaSize.size24} text="Shift Lead" />
                </Stack>
            </Stack.Item>
        </Stack>
    );
}

export default Header;