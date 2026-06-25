import { createBrowserRouter } from "react-router-dom";
import MainLayout from "../layouts/MainLayout/MainLayout";
import { HomePage } from "../pages/homepage/HomePage";
import { LeaderboardPage } from "../pages/leaderboard/LeaderboardPage";
import { PlayerListPage } from "../pages/playerlist/PlayerListPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { MatchListPage } from "../pages/matchlist/MatchListPage";
import { Alert } from "antd";

export const routers = createBrowserRouter([
    {
        path: "/loign",
        element: <div>Login</div>,
    },
    {
        path: "register",
        element: <div>Register</div>,
    },
    {
        path: "/",
        element: <MainLayout />,
        children: [
            {
                path: "/",
                element: <HomePage />,
                index: true
            },
            {
                path: "/leaderboard",
                element: <LeaderboardPage />,
            },
            {
                path: "/list",
                element: <PlayerListPage />,
            },
            {
                path: "/dashboard",
                element: <DashboardPage />,
            },
            {
                path: "/matches",
                element: <MatchListPage />,
            },
            {
                path: "*",
                element: <Alert type="warning" message="Trang không tồn tại" showIcon />,
            }
        ]
    }
])