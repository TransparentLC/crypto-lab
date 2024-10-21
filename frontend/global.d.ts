interface Window {
    chiya: {
        message: import('naive-ui').MessageProviderInst,
        dialog: import('naive-ui').DialogProviderInst,
        notification: import('naive-ui').NotificationProviderInst,
        route: (e: string) => void,
    },
}
