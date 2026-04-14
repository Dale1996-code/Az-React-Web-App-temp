import { FC } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@fluentui/react';
import { initializeIcons } from '@fluentui/react/lib/Icons';
import Layout from './layout/layout';
import Telemetry from './components/telemetry';
import { DarkTheme } from './ux/theme';
import './App.css';

initializeIcons(undefined, { disableWarnings: true });

const App: FC = () => {
    return (
        <ThemeProvider applyTo="body" theme={DarkTheme}>
            <BrowserRouter>
                <Telemetry>
                    <Layout />
                </Telemetry>
            </BrowserRouter>
        </ThemeProvider>
    );
};

export default App;
