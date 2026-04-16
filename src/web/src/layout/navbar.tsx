import { FC, ReactElement } from 'react';
import { Nav, INavLinkGroup, INavStyles } from '@fluentui/react';
import { useNavigate, useLocation } from 'react-router-dom';

// Navigation links for all Dales Operations sections
const navLinkGroups: INavLinkGroup[] = [
    {
        links: [
            { name: 'Dashboard',     url: '/',            key: 'dashboard',    iconProps: { iconName: 'ViewDashboard' } },
            { name: 'Employees',     url: '/employees',   key: 'employees',    iconProps: { iconName: 'People' } },
            { name: 'Tasks',         url: '/tasks',       key: 'tasks',        iconProps: { iconName: 'TaskSolid' } },
            { name: 'Productivity',  url: '/productivity',key: 'productivity', iconProps: { iconName: 'BarChart4' } },
            { name: 'Coaching',      url: '/coaching',    key: 'coaching',     iconProps: { iconName: 'Education' } },
            { name: 'Issues',        url: '/issues',      key: 'issues',       iconProps: { iconName: 'Warning' } },
            { name: 'Daily Summary', url: '/summary',     key: 'summary',      iconProps: { iconName: 'ClipboardList' } },
        ],
    },
];

const navStyles: Partial<INavStyles> = {
    root: {
        width: 300,
        paddingTop: 10,
    },
};

type NavBarProps = {
    onLinkClick?: () => void;
};

const NavBar: FC<NavBarProps> = ({ onLinkClick }): ReactElement => {
    const navigate = useNavigate();
    const location = useLocation();

    // Match the current URL path to a nav key so the active item is highlighted
    const activeKey =
        navLinkGroups[0].links.find(link => link.url === location.pathname)?.key ?? 'dashboard';

    return (
        <Nav
            groups={navLinkGroups}
            selectedKey={activeKey}
            styles={navStyles}
            onLinkClick={(ev, item) => {
                ev?.preventDefault();
                if (item?.url) {
                    navigate(item.url);
                    onLinkClick?.();
                }
            }}
        />
    );
};

export default NavBar;
