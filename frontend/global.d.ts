interface Window {
    chiya: {
        message: import('naive-ui').MessageProviderInst,
        dialog: import('naive-ui').DialogProviderInst,
        notification: import('naive-ui').NotificationProviderInst,
        route: (e: import('vue-router').RouteLocationRaw) => void,
        getCurrentRoute: () => import('vue-router').RouteLocationNormalizedLoadedGeneric | void,
    },
}
