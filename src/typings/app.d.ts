/** The global namespace for the app */
declare namespace App {
  /** Theme namespace */
  namespace Theme {
    type ColorPaletteNumber = import('@sa/color').ColorPaletteNumber;

    /** NaiveUI theme overrides that can be specified in preset */
    type NaiveUIThemeOverride = import('naive-ui').GlobalThemeOverrides;

    /** Theme setting */
    interface ThemeSetting {
      /** Theme scheme */
      themeScheme: UnionKey.ThemeScheme;
      /** grayscale mode */
      grayscale: boolean;
      /** colour weakness mode */
      colourWeakness: boolean;
      /** Whether to recommend color */
      recommendColor: boolean;
      /** Theme color */
      themeColor: string;
      /** Theme radius */
      themeRadius: number;
      /** Other color */
      otherColor: OtherColor;
      /** Whether info color is followed by the primary color */
      isInfoFollowPrimary: boolean;
      /** Layout */
      layout: {
        /** Layout mode */
        mode: UnionKey.ThemeLayoutMode;
        /** Scroll mode */
        scrollMode: UnionKey.ThemeScrollMode;
      };
      /** Page */
      page: {
        /** Whether to show the page transition */
        animate: boolean;
        /** Page animate mode */
        animateMode: UnionKey.ThemePageAnimateMode;
      };
      /** Header */
      header: {
        /** Header height */
        height: number;
        /** Header breadcrumb */
        breadcrumb: {
          /** Whether to show the breadcrumb */
          visible: boolean;
          /** Whether to show the breadcrumb icon */
          showIcon: boolean;
        };
        /** Multilingual */
        multilingual: {
          /** Whether to show the multilingual */
          visible: boolean;
        };
        globalSearch: {
          /** Whether to show the GlobalSearch */
          visible: boolean;
        };
      };
      /** Tab */
      tab: {
        /** Whether to show the tab */
        visible: boolean;
        /**
         * Whether to cache the tab
         *
         * If cache, the tabs will get from the local storage when the page is refreshed
         */
        cache: boolean;
        /** Tab height */
        height: number;
        /** Tab mode */
        mode: UnionKey.ThemeTabMode;
        /** Whether to close tab by middle click */
        closeTabByMiddleClick: boolean;
      };
      /** Fixed header and tab */
      fixedHeaderAndTab: boolean;
      /** Sider */
      sider: {
        /** Inverted sider */
        inverted: boolean;
        /** Sider width */
        width: number;
        /** Collapsed sider width */
        collapsedWidth: number;
        /** Sider width when the layout is 'vertical-mix', 'top-hybrid-sidebar-first', or 'top-hybrid-header-first' */
        mixWidth: number;
        /**
         * Collapsed sider width when the layout is 'vertical-mix', 'top-hybrid-sidebar-first', or
         * 'top-hybrid-header-first'
         */
        mixCollapsedWidth: number;
        /** Child menu width when the layout is 'vertical-mix', 'top-hybrid-sidebar-first', or 'top-hybrid-header-first' */
        mixChildMenuWidth: number;
        /** Whether to auto select the first submenu */
        autoSelectFirstMenu: boolean;
      };
      /** Footer */
      footer: {
        /** Whether to show the footer */
        visible: boolean;
        /** Whether fixed the footer */
        fixed: boolean;
        /** Footer height */
        height: number;
        /**
         * Whether float the footer to the right when the layout is 'top-hybrid-sidebar-first' or
         * 'top-hybrid-header-first'
         */
        right: boolean;
      };
      /** Watermark */
      watermark: {
        /** Whether to show the watermark */
        visible: boolean;
        /** Watermark text */
        text: string;
        /** Whether to use user name as watermark text */
        enableUserName: boolean;
        /** Whether to use current time as watermark text */
        enableTime: boolean;
        /** Time format for watermark text */
        timeFormat: string;
      };
      /** define some theme settings tokens, will transform to css variables */
      tokens: {
        light: ThemeSettingToken;
        dark?: {
          [K in keyof ThemeSettingToken]?: Partial<ThemeSettingToken[K]>;
        };
      };
    }

    interface OtherColor {
      info: string;
      success: string;
      warning: string;
      error: string;
    }

    interface ThemeColor extends OtherColor {
      primary: string;
    }

    type ThemeColorKey = keyof ThemeColor;

    type ThemePaletteColor = {
      [key in ThemeColorKey | `${ThemeColorKey}-${ColorPaletteNumber}`]: string;
    };

    type BaseToken = Record<string, Record<string, string>>;

    interface ThemeSettingTokenColor {
      /** the progress bar color, if not set, will use the primary color */
      nprogress?: string;
      container: string;
      layout: string;
      inverted: string;
      'base-text': string;
    }

    interface ThemeSettingTokenBoxShadow {
      header: string;
      sider: string;
      tab: string;
    }

    interface ThemeSettingToken {
      colors: ThemeSettingTokenColor;
      boxShadow: ThemeSettingTokenBoxShadow;
    }

    type ThemeTokenColor = ThemePaletteColor & ThemeSettingTokenColor;

    /** Theme token CSS variables */
    type ThemeTokenCSSVars = {
      colors: ThemeTokenColor & { [key: string]: string };
      boxShadow: ThemeSettingTokenBoxShadow & { [key: string]: string };
    };
  }

  /** Global namespace */
  namespace Global {
    type VNode = import('vue').VNode;
    type RouteLocationNormalizedLoaded = import('vue-router').RouteLocationNormalizedLoaded;
    type RouteKey = import('@elegant-router/types').RouteKey;
    type RouteMap = import('@elegant-router/types').RouteMap;
    type RoutePath = import('@elegant-router/types').RoutePath;
    type LastLevelRouteKey = import('@elegant-router/types').LastLevelRouteKey;

    /** The router push options */
    type RouterPushOptions = {
      query?: Record<string, string>;
      params?: Record<string, string>;
      force?: boolean;
    };

    /** The global header props */
    interface HeaderProps {
      /** Whether to show the logo */
      showLogo?: boolean;
      /** Whether to show the menu toggler */
      showMenuToggler?: boolean;
      /** Whether to show the menu */
      showMenu?: boolean;
    }

    /** The global menu */
    type Menu = {
      /**
       * The menu key
       *
       * Equal to the route key
       */
      key: string;
      /** The menu label */
      label: string;
      /** The menu i18n key */
      i18nKey?: I18n.I18nKey | null;
      /** The route key */
      routeKey: RouteKey;
      /** The route path */
      routePath: RoutePath;
      /** The menu icon */
      icon?: () => VNode;
      /** The menu children */
      children?: Menu[];
    };

    type Breadcrumb = Omit<Menu, 'children'> & {
      options?: Breadcrumb[];
    };

    /** Tab route */
    type TabRoute = Pick<RouteLocationNormalizedLoaded, 'name' | 'path' | 'meta'> &
      Partial<Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'query' | 'matched'>>;

    /** The global tab */
    type Tab = {
      /** The tab id */
      id: string;
      /** The tab label */
      label: string;
      /**
       * The new tab label
       *
       * If set, the tab label will be replaced by this value
       */
      newLabel?: string;
      /**
       * The old tab label
       *
       * when reset the tab label, the tab label will be replaced by this value
       */
      oldLabel?: string;
      /** The tab route key */
      routeKey: LastLevelRouteKey;
      /** The tab route path */
      routePath: RouteMap[LastLevelRouteKey];
      /** The tab route full path */
      fullPath: string;
      /** The tab fixed index */
      fixedIndex?: number | null;
      /**
       * Tab icon
       *
       * Iconify icon
       */
      icon?: string;
      /**
       * Tab local icon
       *
       * Local icon
       */
      localIcon?: string;
      /** I18n key */
      i18nKey?: I18n.I18nKey | null;
    };

    /** Form rule */
    type FormRule = import('naive-ui').FormItemRule;

    /** The global dropdown key */
    type DropdownKey = 'closeCurrent' | 'closeOther' | 'closeLeft' | 'closeRight' | 'closeAll' | 'pin' | 'unpin';
  }

  /**
   * I18n namespace
   *
   * Locales type
   */
  namespace I18n {
    type RouteKey = import('@elegant-router/types').RouteKey;

    type LangType = 'en-US' | 'zh-CN';

    type LangOption = {
      label: string;
      key: LangType;
    };

    type I18nRouteKey = Exclude<RouteKey, 'root' | 'not-found'>;

    type FormMsg = {
      required: string;
      invalid: string;
    };

    type Schema = {
      system: {
        title: string;
        updateTitle: string;
        updateContent: string;
        updateConfirm: string;
        updateCancel: string;
      };
      common: {
        action: string;
        add: string;
        addSuccess: string;
        back: string;
        backToHome: string;
        batchDelete: string;
        cancel: string;
        close: string;
        check: string;
        selectAll: string;
        expandColumn: string;
        columnSetting: string;
        config: string;
        confirm: string;
        delete: string;
        deleteSuccess: string;
        confirmDelete: string;
        edit: string;
        warning: string;
        error: string;
        index: string;
        keywordSearch: string;
        logout: string;
        logoutConfirm: string;
        lookForward: string;
        modify: string;
        modifySuccess: string;
        noData: string;
        operate: string;
        pleaseCheckValue: string;
        refresh: string;
        reset: string;
        search: string;
        switch: string;
        tip: string;
        trigger: string;
        update: string;
        updateSuccess: string;
        userCenter: string;
        yesOrNo: {
          yes: string;
          no: string;
        };
      };
      request: {
        logout: string;
        logoutMsg: string;
        logoutWithModal: string;
        logoutWithModalMsg: string;
        refreshToken: string;
        tokenExpired: string;
      };
      theme: {
        themeDrawerTitle: string;
        tabs: {
          appearance: string;
          layout: string;
          general: string;
          preset: string;
        };
        appearance: {
          themeSchema: { title: string } & Record<UnionKey.ThemeScheme, string>;
          grayscale: string;
          colourWeakness: string;
          themeColor: {
            title: string;
            followPrimary: string;
          } & Record<Theme.ThemeColorKey, string>;
          recommendColor: string;
          recommendColorDesc: string;
          themeRadius: {
            title: string;
          };
          preset: {
            title: string;
            apply: string;
            applySuccess: string;
            [key: string]:
              | {
                  name: string;
                  desc: string;
                }
              | string;
          };
        };
        layout: {
          layoutMode: { title: string } & Record<UnionKey.ThemeLayoutMode, string> & {
              [K in `${UnionKey.ThemeLayoutMode}_detail`]: string;
            };
          tab: {
            title: string;
            visible: string;
            cache: string;
            cacheTip: string;
            height: string;
            mode: { title: string } & Record<UnionKey.ThemeTabMode, string>;
            closeByMiddleClick: string;
            closeByMiddleClickTip: string;
          };
          header: {
            title: string;
            height: string;
            breadcrumb: {
              visible: string;
              showIcon: string;
            };
          };
          sider: {
            title: string;
            inverted: string;
            width: string;
            collapsedWidth: string;
            mixWidth: string;
            mixCollapsedWidth: string;
            mixChildMenuWidth: string;
            autoSelectFirstMenu: string;
            autoSelectFirstMenuTip: string;
          };
          footer: {
            title: string;
            visible: string;
            fixed: string;
            height: string;
            right: string;
          };
          content: {
            title: string;
            scrollMode: { title: string; tip: string } & Record<UnionKey.ThemeScrollMode, string>;
            page: {
              animate: string;
              mode: { title: string } & Record<UnionKey.ThemePageAnimateMode, string>;
            };
            fixedHeaderAndTab: string;
          };
        };
        general: {
          title: string;
          watermark: {
            title: string;
            visible: string;
            text: string;
            enableUserName: string;
            enableTime: string;
            timeFormat: string;
          };
          multilingual: {
            title: string;
            visible: string;
          };
          globalSearch: {
            title: string;
            visible: string;
          };
        };
        configOperation: {
          copyConfig: string;
          copySuccessMsg: string;
          resetConfig: string;
          resetSuccessMsg: string;
        };
      };
      route: Record<I18nRouteKey, string>;
      page: {
        login: {
          common: {
            loginOrRegister: string;
            userNamePlaceholder: string;
            phonePlaceholder: string;
            codePlaceholder: string;
            passwordPlaceholder: string;
            confirmPasswordPlaceholder: string;
            codeLogin: string;
            confirm: string;
            back: string;
            validateSuccess: string;
            loginSuccess: string;
            welcomeBack: string;
          };
          pwdLogin: {
            title: string;
            rememberMe: string;
            forgetPassword: string;
            register: string;
            otherAccountLogin: string;
            otherLoginMode: string;
            superAdmin: string;
            admin: string;
            user: string;
          };
          codeLogin: {
            title: string;
            getCode: string;
            reGetCode: string;
            sendCodeSuccess: string;
            imageCodePlaceholder: string;
          };
          register: {
            title: string;
            agreement: string;
            protocol: string;
            policy: string;
          };
          resetPwd: {
            title: string;
          };
          bindWeChat: {
            title: string;
          };
        };
        home: {
          branchDesc: string;
          greeting: string;
          weatherDesc: string;
          projectCount: string;
          todo: string;
          message: string;
          downloadCount: string;
          registerCount: string;
          schedule: string;
          study: string;
          work: string;
          rest: string;
          entertainment: string;
          visitCount: string;
          turnover: string;
          dealCount: string;
          projectNews: {
            title: string;
            moreNews: string;
            desc1: string;
            desc2: string;
            desc3: string;
            desc4: string;
            desc5: string;
          };
          creativity: string;
        };
        manage: {
          common: {
            status: {
              enable: string;
              disable: string;
            };
            enableSuccess: string;
            disableSuccess: string;
            batchDeleteSuccess: string;
            batchDeletePartial: string;
          };
          role: {
            title: string;
            roleName: string;
            roleCode: string;
            roleStatus: string;
            roleDesc: string;
            menuAuth: string;
            buttonAuth: string;
            order: string;
            keyword: string;
            assignMenu: string;
            assignPermission: string;
            superAdminCodeLocked: string;
            roleNameLengthRule: string;
            roleCodeRule: string;
            defaultHome: string;
            homePlaceholder: string;
            noMenuToAssign: string;
            form: {
              roleName: string;
              roleCode: string;
              roleStatus: string;
              roleDesc: string;
              order: string;
              keyword: string;
            };
            addRole: string;
            editRole: string;
          };
          user: {
            title: string;
            userName: string;
            userGender: string;
            nickName: string;
            userPhone: string;
            userEmail: string;
            userStatus: string;
            userRole: string;
            password: string;
            createdAt: string;
            keyword: string;
            resetPwd: string;
            assignRole: string;
            userNameRule: string;
            pwdRule: string;
            noRoleToAssign: string;
            newPassword: string;
            confirmPassword: string;
            form: {
              userName: string;
              userGender: string;
              nickName: string;
              userPhone: string;
              userEmail: string;
              userStatus: string;
              userRole: string;
              password: string;
              keyword: string;
              confirmPassword: string;
            };
            addUser: string;
            editUser: string;
            gender: {
              male: string;
              female: string;
            };
          };
          menu: {
            home: string;
            title: string;
            id: string;
            parentId: string;
            menuType: string;
            menuName: string;
            routeName: string;
            routePath: string;
            pathParam: string;
            layout: string;
            page: string;
            i18nKey: string;
            icon: string;
            localIcon: string;
            iconTypeTitle: string;
            order: string;
            constant: string;
            keepAlive: string;
            href: string;
            hideInMenu: string;
            activeMenu: string;
            multiTab: string;
            fixedIndexInTab: string;
            query: string;
            button: string;
            buttonCode: string;
            buttonDesc: string;
            menuStatus: string;
            routePathAuto: string;
            i18nKeyAuto: string;
            form: {
              home: string;
              menuType: string;
              menuName: string;
              routeName: string;
              routePath: string;
              pathParam: string;
              page: string;
              layout: string;
              i18nKey: string;
              icon: string;
              localIcon: string;
              order: string;
              keepAlive: string;
              href: string;
              hideInMenu: string;
              activeMenu: string;
              multiTab: string;
              fixedInTab: string;
              fixedIndexInTab: string;
              queryKey: string;
              queryValue: string;
              button: string;
              buttonCode: string;
              buttonDesc: string;
              menuStatus: string;
            };
            addMenu: string;
            editMenu: string;
            addChildMenu: string;
            updateSuccess: string;
            addSuccess: string;
            type: {
              directory: string;
              menu: string;
            };
            iconType: {
              iconify: string;
              local: string;
            };
          };
          app: {
            title: string;
            appCode: string;
            appName: string;
            description: string;
            status: string;
            createdAt: string;
            updatedAt: string;
            keyword: string;
            detail: string;
            createApp: string;
            deleteApp: string;
            apiKey: string;
            apiSecret: string;
            ssoClient: string;
            clientId: string;
            redirectUris: string;
            postLogoutRedirectUris: string;
            scopes: string;
            grants: string;
            ssoConfig: string;
            saveSsoConfig: string;
            uriRequired: string;
            uriPlaceholder: string;
            notGenerated: string;
            generateSecret: string;
            resetSecret: string;
            provisionSso: string;
            resetSsoSecret: string;
            ssoNotProvisioned: string;
            ssoNotProvisionedHint: string;
            save: string;
            basicInfo: string;
            secretModal: {
              title: string;
              description: string;
            };
            resetSecretConfirm: {
              title: string;
              content: string;
            };
            resetSsoSecretConfirm: {
              title: string;
              content: string;
            };
            ssoEnableSuccess: string;
            ssoDisableSuccess: string;
            appCodeRule: string;
            appNameLengthRule: string;
            appDescriptionLengthRule: string;
            copy: string;
            copySuccess: string;
            masked: string;
            form: {
              appCode: string;
              appName: string;
              description: string;
              keyword: string;
            };
          };
          permission: {
            module: {
              user: string;
              role: string;
              menu: string;
              permission: string;
            };
            noPermissionToAssign: string;
          };
        };
        payment: {
          stats: {
            refresh: string;
            states: {
              loadFailed: string;
              noData: string;
            };
            overview: {
              title: string;
              paymentCount: string;
              paymentAmount: string;
              refundCount: string;
              refundAmount: string;
              successRate: string;
              netAmount: string;
            };
            statusDistribution: {
              title: string;
              paymentStatus: string;
              refundStatus: string;
              refundBacklog: string;
              backlogCount: string;
              backlogAmount: string;
            };
            gatewayHealth: {
              title: string;
              bankInterface: string;
              totalCount: string;
              successCount: string;
              successRate: string;
              avgExecutionTimeMs: string;
              returnCodes: string;
            };
            operationsAudit: {
              title: string;
              totalAudits: string;
              auditCount: string;
              approvedCount: string;
              rejectedCount: string;
              approvalRate: string;
              avgDuration: string;
              auditor: string;
            };
            byBusinessSystem: {
              title: string;
              paymentCount: string;
              refundCount: string;
            };
            byChannel: {
              title: string;
              byPayMode: string;
              byAccessType: string;
              paymentCount: string;
            };
            anomalies: {
              title: string;
              longPending: string;
              longRefunding: string;
              recentFailure: string;
              count: string;
              healthy: string;
            };
            operationsActivity: {
              title: string;
            };
          };
          order: {
            title: string;
            paymentOrderNo: string;
            businessOrderNo: string;
            businessSystemName: string;
            status: string;
            amount: string;
            amountRange: string;
            amountMin: string;
            amountMax: string;
            payMode: string;
            accessType: string;
            paymentChannel: string;
            paidAt: string;
            createdAt: string;
            moreFilters: string;
            detail: string;
            basicInfo: string;
            lifecycle: string;
            resendNotification: string;
            resendConfirm: {
              title: string;
              content: string;
            };
            resendSuccess: string;
            form: {
              paymentOrderNo: string;
              businessOrderNo: string;
              businessSystemName: string;
              status: string;
              payMode: string;
              accessType: string;
              paymentChannel: string;
              createdAt: string;
              paidAt: string;
            };
          };
          refund: {
            title: string;
            refundOrderNo: string;
            paymentOrderNo: string;
            businessOrderNo: string;
            businessSystemName: string;
            status: string;
            refundAmount: string;
            refundAmountRange: string;
            refundAmountMin: string;
            refundAmountMax: string;
            auditType: string;
            auditor: string;
            auditorId: string;
            createdAt: string;
            moreFilters: string;
            detail: string;
            basicInfo: string;
            lifecycle: string;
            resendNotification: string;
            resendConfirm: {
              title: string;
              content: string;
            };
            resendSuccess: string;
            audit: string;
            auditTitle: string;
            auditDecision: string;
            auditApprove: string;
            auditReject: string;
            auditReason: string;
            auditReasonPlaceholder: string;
            auditReasonRequired: string;
            auditReasonMax: string;
            auditSuccess: string;
            form: {
              refundOrderNo: string;
              paymentOrderNo: string;
              businessOrderNo: string;
              businessSystemName: string;
              status: string;
              auditType: string;
              auditorId: string;
              createdAt: string;
            };
          };
          channelLog: {
            title: string;
            paymentOrderNo: string;
            refundOrderNo: string;
            logType: string;
            httpStatus: string;
            errorMessage: string;
            success: string;
            createdAt: string;
            moreFilters: string;
            form: {
              paymentOrderNo: string;
              refundOrderNo: string;
              logType: string;
              bankInterface: string;
              success: string;
              returnCode: string;
              createdAt: string;
            };
          };
          operation: {
            title: string;
            targetType: string;
            targetNo: string;
            operation: string;
            operatorSystem: string;
            result: string;
            createdAt: string;
            moreFilters: string;
            form: {
              targetType: string;
              targetNo: string;
              operation: string;
              operatorId: string;
              operatorSystem: string;
              result: string;
              createdAt: string;
            };
          };
          enum: {
            paymentStatus: {
              pending: string;
              paid: string;
              failed: string;
              cancelled: string;
              expired: string;
            };
            payMode: {
              wechat: string;
              alipay: string;
              unionpay: string;
            };
            accessType: {
              app: string;
              wechatOa: string;
              alipayLife: string;
              miniProgram: string;
            };
            paymentChannel: {
              icbc: string;
            };
            refundStatus: {
              pending: string;
              rejected: string;
              approved: string;
              refunding: string;
              success: string;
              failed: string;
            };
            auditType: {
              auto: string;
              manual: string;
            };
            logType: {
              paymentRequest: string;
              paymentQuery: string;
              paymentCancel: string;
              refundRequest: string;
              refundQuery: string;
              paymentCallback: string;
            };
            operationType: {
              auditApprove: string;
              auditReject: string;
              notifyResend: string;
            };
            operationTargetType: {
              payment: string;
              refund: string;
            };
          };
          lifecycle: {
            success: string;
            fail: string;
            unknown: string;
            executionTime: string;
            returnCode: string;
            returnMsg: string;
            bankInterface: string;
            operator: string;
            remark: string;
            performer: string;
            detail: string;
            noEvents: string;
          };
        };
        account: {
          title: string;
          detailTitle: string;
          userId: string;
          nickname: string;
          email: string;
          phone: string;
          status: string;
          locked: string;
          detail: string;
          more: string;
          form: {
            email: string;
            phone: string;
            userId: string;
            status: string;
            locked: string;
            createdRange: string;
          };
          statusEnum: {
            active: string;
            disabled: string;
            locked: string;
            unlocked: string;
          };
          banner: {
            active: string;
            locked: string;
            disabled: string;
            disabledLocked: string;
          };
          action: {
            disable: string;
            activate: string;
            unlock: string;
            revoke: string;
          };
          confirm: {
            target: string;
            activate: string;
            unlock: string;
            revoke: string;
          };
          disableModal: {
            title: string;
            tip: string;
            reasonPlaceholder: string;
            confirm: string;
          };
          success: {
            disabled: string;
            activated: string;
            unlocked: string;
            revoked: string;
          };
        };
        aiplatform: {
          order: {
            title: string;
            detailTitle: string;
            orderId: string;
            projectId: string;
            projectName: string;
            owner: string;
            status: string;
            deliverableType: string;
            amount: string;
            createdAt: string;
            quotedAt: string;
            detail: string;
            more: string;
            form: {
              status: string;
              createdRange: string;
              externalId: string;
              orderId: string;
            };
            statusEnum: {
              pendingQuote: string;
              quoted: string;
              paid: string;
              archived: string;
              cancelled: string;
            };
            drawer: {
              tabs: {
                basic: string;
              };
              priceHistory: string;
              prdSnapshot: string;
              prdVersionNo: string;
              demoVersionNo: string;
              scopeDeliverables: string;
              scopeAcceptance: string;
              scopeTimeline: string;
              priceAmount: string;
              priceNote: string;
              priceOperator: string;
              priceAt: string;
              paidAt: string;
              archivedAt: string;
              archiveOperator: string;
              cancelledAt: string;
              cancelReason: string;
              cancelOperator: string;
              downloadPackage: string;
              downloadDesignPackage: string;
            };
            action: {
              quote: string;
              requote: string;
              scope: string;
              cancel: string;
              retryArchive: string;
              createContract: string;
            };
            scopeModal: {
              title: string;
              tip: string;
              deliverablesPlaceholder: string;
              acceptancePlaceholder: string;
              timelinePlaceholder: string;
              confirm: string;
            };
            quoteModal: {
              title: string;
              requoteTitle: string;
              amount: string;
              note: string;
              amountPlaceholder: string;
              notePlaceholder: string;
              confirm: string;
            };
            cancelModal: {
              title: string;
              tip: string;
              reasonPlaceholder: string;
              confirm: string;
            };
            confirm: {
              retryArchive: string;
              target: string;
            };
            createContractConfirm: {
              title: string;
              tip: string;
            };
            success: {
              quoted: string;
              scopeEntered: string;
              cancelled: string;
              retried: string;
              downloaded: string;
              downloadedDesign: string;
              contractCreated: string;
            };
          };
          payment: {
            tab: string;
            empty: string;
            overview: string;
            contractNo: string;
            totalAmount: string;
            totalSettled: string;
            createdAt: string;
            nodes: string;
            nodesEmpty: string;
            node: {
              seq: string;
              name: string;
              amount: string;
              remarkCode: string;
              kickoffGate: string;
              kickoffGateTag: string;
              status: string;
              settledAmount: string;
              remainingAmount: string;
              operate: string;
            };
            vouchers: string;
            vouchersEmpty: string;
            voucher: {
              node: string;
              fileName: string;
              size: string;
              createdAt: string;
              download: string;
            };
            trails: string;
            trailsEmpty: string;
            history: string;
            historyRow: {
              contractNo: string;
              nodeCount: string;
              totalAmount: string;
              totalSettled: string;
              createdAt: string;
            };
            action: {
              enterNodes: string;
              reEnterNodes: string;
              verify: string;
              reject: string;
            };
            nodesModal: {
              title: string;
              tip: string;
              addRow: string;
              namePlaceholder: string;
              amountPlaceholder: string;
              kickoffGate: string;
              confirm: string;
            };
            verifyModal: {
              title: string;
              tip: string;
              actualAmount: string;
              actualAmountPlaceholder: string;
              arrivedAt: string;
              voucherId: string;
              voucherIdPlaceholder: string;
              channelRefNo: string;
              channelRefNoPlaceholder: string;
              basis: string;
              basisPlaceholder: string;
              confirm: string;
            };
            rejectModal: {
              title: string;
              tip: string;
              basisPlaceholder: string;
              confirm: string;
            };
            success: {
              nodesEntered: string;
              verified: string;
              rejected: string;
              voucherDownloaded: string;
            };
          };
          production: {
            tab: string;
            empty: string;
            status: string;
            contact: string;
            nextStep: string;
            progressNote: string;
            estimatedStartAt: string;
            transitions: string;
            systemCreated: string;
            needsUserSupplement: string;
            supplementStateUnknown: string;
            supplementConfirm: {
              setTitle: string;
              clearTitle: string;
              setTip: string;
              clearTip: string;
            };
            action: {
              update: string;
              advance: string;
            };
            advanceConfirm: {
              title: string;
              tip: string;
              basisPlaceholder: string;
            };
            updateModal: {
              title: string;
              tip: string;
              contactPlaceholder: string;
              nextStepPlaceholder: string;
              progressNotePlaceholder: string;
              estimatedStartAtPlaceholder: string;
              basisPlaceholder: string;
              confirm: string;
            };
            success: {
              updated: string;
              advanced: string;
              supplementSet: string;
              supplementCleared: string;
            };
          };
          project: {
            title: string;
            detailTitle: string;
            projectId: string;
            name: string;
            owner: string;
            type: string;
            status: string;
            archived: string;
            archivedYes: string;
            archivedNo: string;
            createdAt: string;
            updatedAt: string;
            detail: string;
            form: {
              createdRange: string;
              externalId: string;
              projectId: string;
            };
            statusEnum: {
              all: string;
              inProgress: string;
              archived: string;
            };
            drawer: {
              tabs: {
                basic: string;
                conversation: string;
                prd: string;
                versions: string;
                files: string;
              };
              workspaceId: string;
              prdProducedAt: string;
              generatedAt: string;
              activeOrder: string;
              latestOrder: string;
              noActiveOrder: string;
              noOrder: string;
              costSummary: string;
              costUnpriced: string;
              costComplete: string;
              answered: string;
              pendingAnswer: string;
              emptyConversation: string;
              payloadMissing: string;
              questionMultiple: string;
              annotationSelect: string;
              annotationCircle: string;
              annotationComment: string;
              quoteQuoted: string;
              quoteRepriced: string;
              quoteCopy: string;
              quoteCopied: string;
              quoteRepricedTip: string;
              prdUpdatedAt: string;
              prdEmpty: string;
              versionCommit: string;
              versionSubject: string;
              versionRunId: string;
              versionCommittedAt: string;
              versionRollbackFrom: string;
              runNone: string;
              versionEmpty: string;
              closingCard: string;
              closingMissing: string;
              closingSummary: string;
              closingPrdChanged: string;
              closingSystemChanged: string;
              closingFiles: string;
              closingDuration: string;
              closingSelfTest: string;
              closingSelfTestItems: string;
              closingVersion: string;
              durationH: string;
              durationM: string;
              durationS: string;
              downloadPackage: string;
              filesEmpty: string;
              filesSelectHint: string;
              previewUnavailable: string;
            };
            success: {
              downloaded: string;
            };
          };
          workspace: {
            title: string;
            detailTitle: string;
            workspaceId: string;
            containerName: string;
            networkName: string;
            kind: string;
            status: string;
            provisionError: string;
            desiredState: string;
            containerState: string;
            lastTouchAt: string;
            volumeSize: string;
            sealedAt: string;
            archivePath: string;
            archiveSize: string;
            createdAt: string;
            updatedAt: string;
            detail: string;
            more: string;
            form: {
              desiredPlaceholder: string;
              actualPlaceholder: string;
            };
            desiredEnum: {
              running: string;
              hibernated: string;
              sealed: string;
            };
            actualEnum: {
              running: string;
              stopped: string;
              absent: string;
              unknown: string;
            };
            drawer: {
              project: string;
              projectId: string;
              projectName: string;
              projectArchived: string;
              projectArchivedYes: string;
              projectArchivedNo: string;
              noProject: string;
              resources: string;
              resourcesEmpty: string;
            };
            action: {
              wake: string;
              hibernate: string;
              rebuild: string;
              seal: string;
            };
            confirm: {
              wake: string;
              wakeTip: string;
              hibernate: string;
              hibernateTip: string;
              rebuild: string;
              rebuildTip: string;
              seal: string;
              sealTip: string;
              target: string;
            };
            success: {
              wake: string;
              hibernate: string;
              rebuild: string;
              seal: string;
            };
          };
          cost: {
            title: string;
            window: string;
            windowRequired: string;
            overview: string;
            byModel: string;
            byAgentKind: string;
            costBuckets: string;
            costBucketsEmpty: string;
            tier: {
              input: string;
              output: string;
              cacheRead: string;
              cacheWrite: string;
              reasoning: string;
            };
            unpriced: {
              title: string;
              tip: string;
              provider: string;
              model: string;
              tier: string;
              tokens: string;
            };
            projects: {
              title: string;
              projectId: string;
              cost: string;
              pricing: string;
              allUnpriced: string;
              priced: string;
            };
            drawer: {
              detailTitle: string;
              unpricedTitle: string;
              unpricedEmpty: string;
            };
            states: {
              noData: string;
              loadFailed: string;
            };
          };
          priceEntry: {
            title: string;
            id: string;
            provider: string;
            model: string;
            tokenKind: string;
            unitPrice: string;
            currency: string;
            effectiveFrom: string;
            effectiveTo: string;
            operator: string;
            current: string;
            target: string;
            action: {
              reprice: string;
              deactivate: string;
            };
            form: {
              providerPlaceholder: string;
              modelPlaceholder: string;
            };
            repriceModal: {
              title: string;
              unitPrice: string;
              unitPricePlaceholder: string;
              currency: string;
              effectiveFrom: string;
              confirm: string;
              receiptTitle: string;
              receiptClosed: string;
              receiptOpened: string;
              receiptOpen: string;
              receiptNote: string;
              done: string;
            };
            confirm: {
              deactivate: string;
              deactivateTip: string;
            };
            success: {
              repriced: string;
              deactivated: string;
            };
          };
          material: {
            title: string;
            detailTitle: string;
            id: string;
            kind: string;
            materialTitle: string;
            project: string;
            projectId: string;
            projectName: string;
            status: string;
            sunkAt: string;
            operator: string;
            detail: string;
            statusEnum: {
              enabled: string;
              disabled: string;
            };
            action: {
              disable: string;
              enable: string;
              delete: string;
            };
            form: {
              statusPlaceholder: string;
              sunkRange: string;
              projectIdPlaceholder: string;
            };
            drawer: {
              content: string;
            };
            confirm: {
              target: string;
              disable: string;
              disableTip: string;
              enable: string;
              enableTip: string;
              delete: string;
              deleteTip: string;
            };
            success: {
              disable: string;
              enable: string;
              delete: string;
            };
          };
          skill: {
            title: string;
            detailTitle: string;
            id: string;
            name: string;
            description: string;
            source: string;
            sourcePackage: string;
            version: string;
            status: string;
            operator: string;
            updateAvailable: string;
            updatable: string;
            detail: string;
            more: string;
            install: string;
            action: {
              disable: string;
              enable: string;
              uninstall: string;
              update: string;
              traces: string;
            };
            drawer: {
              basic: string;
              frontmatter: string;
              frontmatterEmpty: string;
              content: string;
              resources: string;
            };
            /** Usage-count observability (#71): loadCount JSON-string three-state texts. */
            loadCount: string;
            lastLoadedAt: string;
            loadNever: string;
            loadBuiltinNa: string;
            installModal: {
              title: string;
              receiptTitle: string;
              receiptNote: string;
              done: string;
              confirm: string;
              tip: string;
              repoUrl: string;
              repoUrlPlaceholder: string;
              excludeDirs: string;
              excludeDirsPlaceholder: string;
            };
            updateModal: {
              title: string;
              done: string;
              noOp: string;
              updatedNote: string;
              removed: string;
              removedEmpty: string;
              terminal: string;
            };
            tracesDrawer: {
              title: string;
              empty: string;
            };
            confirm: {
              target: string;
              updateTarget: string;
              disable: string;
              disableTip: string;
              enable: string;
              enableTip: string;
              uninstall: string;
              uninstallTip: string;
              update: string;
              updateTip: string;
            };
            success: {
              disable: string;
              enable: string;
              uninstall: string;
            };
          };
          /** Draft review page (#71 — skill-line drafts 4 endpoints). */
          skillDraft: {
            title: string;
            detailTitle: string;
            basic: string;
            id: string;
            name: string;
            description: string;
            slot: string;
            projectId: string;
            runId: string;
            scanVerdict: string;
            status: string;
            createdAt: string;
            detail: string;
            more: string;
            content: string;
            verdict: {
              safe: string;
              caution: string;
            };
            finding: {
              title: string;
              empty: string;
              patternId: string;
              severity: string;
              category: string;
              location: string;
              description: string;
            };
            action: {
              promote: string;
              reject: string;
            };
            confirm: {
              target: string;
              promote: string;
              promoteTip: string;
            };
            promoteReceipt: {
              title: string;
              note: string;
              done: string;
            };
            rejectModal: {
              title: string;
              receiptTitle: string;
              receiptNote: string;
              reason: string;
              reasonPlaceholder: string;
              confirm: string;
              done: string;
              operator: string;
              reviewedAt: string;
              rejectReason: string;
            };
          };
          /** 指派配置页（#68——技能线 assignments 2 端点；行上下文列文案复用 skill.* 同字段键）。 */
          skillAssignment: {
            title: string;
            slot: {
              main: string;
              executor: string;
              subagent: string;
            };
            empty: {
              description: string;
              action: string;
            };
            save: string;
            saved: string;
            precheck: string;
            precheckResult: {
              overlapFound: string;
              noOverlap: string;
              notExecuted: string;
              stale: string;
              skills: string;
              counterpart: string;
              overlap: string;
              resolution: string;
            };
          };
          /** 智能体配置页（#69 初建；#91 三座双档＋边缘四点＋工具面）。 */
          agentConfig: {
            title: string;
            tab: {
              tools: string;
              edge: string;
            };
            agent: {
              main: string;
              executor: string;
              designer: string;
            };
            edge: {
              naming: string;
              compaction: string;
              classification: string;
              precheck: string;
            };
            edit: {
              systemPrompt: string;
              systemPromptPlaceholder: string;
              modelId: string;
              routingStrongModelId: string;
              modelIdPlaceholder: string;
              tierDisabled: string;
              overridden: string;
              defaultTag: string;
              fallbackPrompt: string;
              fallbackModel: string;
              viewDefault: string;
              lastWrite: string;
              save: string;
              saved: string;
            };
            traces: {
              title: string;
              empty: string;
              rollback: string;
              rollbackTitle: string;
              rollbackTip: string;
              rolledBack: string;
            };
            field: {
              systemPrompt: string;
              modelId: string;
              routingStrongModelId: string;
              webSearch: string;
              fetchUrl: string;
            };
            defaultValue: string;
            stateOn: string;
            stateOff: string;
            tool: {
              name: string;
              kind: string;
              enabled: string;
              description: string;
              kindLabel: {
                skeleton: string;
                enhancement: string;
                builtin: string;
              };
              stateOn: string;
              stateOff: string;
              toggled: string;
            };
          };
          /** 账号档案嵌件（#56 有码无页——订单/项目详情抽屉共用，externalId 筛选驱动）。 */
          account: {
            title: string;
            displayName: string;
            accountId: string;
            externalId: string;
            createdAt: string;
          };
          /** 合同域（#87 A 批 T1——六态人工承接：清单/详情三段/七写）。 */
          contract: {
            title: string;
            detailTitle: string;
            contractId: string;
            contractNo: string;
            orderId: string;
            status: string;
            version: string;
            amount: string;
            createdAt: string;
            detail: string;
            more: string;
            needsUpdate: string;
            form: {
              status: string;
              createdRange: string;
              orderId: string;
              contractNo: string;
            };
            statusEnum: {
              preparing: string;
              pendingSign: string;
              signing: string;
              signed: string;
              failed: string;
              withdrawn: string;
            };
            drawer: {
              basic: string;
              scopeSnapshot: string;
              prdSnapshot: string;
              transitions: string;
              transitionsEmpty: string;
              prdVersionNo: string;
              demoVersionNo: string;
              partyA: string;
              partyB: string;
              projectScope: string;
              paymentPlan: string;
              scopeDeliverables: string;
              scopeAcceptance: string;
              scopeTimeline: string;
              partyASigned: string;
              partyBSigned: string;
              signedYes: string;
              signedNo: string;
            };
            action: {
              advance: string;
              fail: string;
              withdraw: string;
              void: string;
              sign: string;
              record: string;
            };
            actionModal: {
              title: string;
              confirm: string;
              tip: string;
              partyA: string;
              partyB: string;
              basisPlaceholder: string;
            };
            recordModal: {
              title: string;
              confirm: string;
              tip: string;
              partyAPlaceholder: string;
              partyBPlaceholder: string;
              projectScopePlaceholder: string;
              paymentPlanPlaceholder: string;
              basisPlaceholder: string;
            };
            success: {
              advance: string;
              fail: string;
              withdraw: string;
              void: string;
              sign: string;
              record: string;
            };
          };
          /** 模型供应商域（#88 B 批 T1——通道 CRUD/掩码口径/远端清单拉取对照＋内嵌入库/留痕）。 */
          modelProvider: {
            title: string;
            providerKey: string;
            baseUrl: string;
            apiKeyMasked: string;
            enabled: string;
            enabledOn: string;
            enabledOff: string;
            lastWrite: string;
            more: string;
            edit: string;
            remove: string;
            traces: string;
            tracesDrawer: {
              title: string;
              empty: string;
              notConfigured: string;
              createTag: string;
              deleteTag: string;
              rollback: string;
              rollbackTip: string;
              field: {
                baseUrl: string;
                apiKey: string;
                enabled: string;
              };
            };
            create: string;
            pull: string;
            catalogDrawer: {
              title: string;
              providerLine: string;
              pulledAt: string;
              modelId: string;
              name: string;
              status: string;
              statusActive: string;
              domain: string;
              tracked: string;
              suggestTag: string;
              ingestColumn: string;
              tierKeyPlaceholder: string;
              ingest: string;
              ingestSuccess: string;
              staleTitle: string;
              staleHint: string;
              errorState: string;
              retry: string;
              empty: string;
            };
            confirm: {
              delete: string;
              deleteTip: string;
            };
            form: {
              createTitle: string;
              updateTitle: string;
              createConfirm: string;
              updateConfirm: string;
              providerKey: string;
              providerKeyPlaceholder: string;
              baseUrl: string;
              baseUrlPlaceholder: string;
              apiKey: string;
              apiKeyCreatePlaceholder: string;
              apiKeyUpdatePlaceholder: string;
              enabled: string;
              effectTip: string;
            };
            success: {
              create: string;
              update: string;
              delete: string;
            };
          };
          /** 模型档位域（#90 B 批 T2——档位 CRUD/停用态/留痕＋per-trace 回滚）。 */
          modelTier: {
            title: string;
            tierKey: string;
            providerKey: string;
            modelName: string;
            displayName: string;
            displayNameFallback: string;
            enabled: string;
            enabledOn: string;
            enabledOff: string;
            lastWrite: string;
            more: string;
            edit: string;
            remove: string;
            traces: string;
            tracesDrawer: {
              title: string;
              empty: string;
              nullValue: string;
              createTag: string;
              deleteTag: string;
              rollback: string;
              rollbackTip: string;
              field: {
                providerKey: string;
                modelName: string;
                displayName: string;
                enabled: string;
              };
            };
            create: string;
            confirm: {
              delete: string;
              deleteTip: string;
            };
            form: {
              createTitle: string;
              updateTitle: string;
              createConfirm: string;
              updateConfirm: string;
              tierKey: string;
              tierKeyPlaceholder: string;
              providerKey: string;
              providerKeyPlaceholder: string;
              providerKeyTip: string;
              modelName: string;
              modelNamePlaceholder: string;
              displayName: string;
              displayNamePlaceholder: string;
              displayNameTip: string;
              enabled: string;
              disableTip: string;
            };
            success: {
              create: string;
              update: string;
              delete: string;
            };
          };
        };
      };
      form: {
        required: string;
        userName: FormMsg;
        phone: FormMsg;
        pwd: FormMsg;
        confirmPwd: FormMsg;
        code: FormMsg;
        email: FormMsg;
      };
      dropdown: Record<Global.DropdownKey, string>;
      icon: {
        themeConfig: string;
        themeSchema: string;
        lang: string;
        fullscreen: string;
        fullscreenExit: string;
        reload: string;
        collapse: string;
        expand: string;
        pin: string;
        unpin: string;
      };
      datatable: {
        itemCount: string;
        fixed: {
          left: string;
          right: string;
          unFixed: string;
        };
      };
    };

    type GetI18nKey<T extends Record<string, unknown>, K extends keyof T = keyof T> = K extends string
      ? T[K] extends Record<string, unknown>
        ? `${K}.${GetI18nKey<T[K]>}`
        : K
      : never;

    type I18nKey = GetI18nKey<Schema>;

    type TranslateOptions<Locales extends string> = import('vue-i18n').TranslateOptions<Locales>;

    interface $T {
      (key: I18nKey): string;
      (key: I18nKey, plural: number, options?: TranslateOptions<LangType>): string;
      (key: I18nKey, defaultMsg: string, options?: TranslateOptions<I18nKey>): string;
      (key: I18nKey, list: unknown[], options?: TranslateOptions<I18nKey>): string;
      (key: I18nKey, list: unknown[], plural: number): string;
      (key: I18nKey, list: unknown[], defaultMsg: string): string;
      (key: I18nKey, named: Record<string, unknown>, options?: TranslateOptions<LangType>): string;
      (key: I18nKey, named: Record<string, unknown>, plural: number): string;
      (key: I18nKey, named: Record<string, unknown>, defaultMsg: string): string;
    }
  }

  /** Service namespace */
  namespace Service {
    /** Other baseURL key */
    type OtherBaseURLKey = 'demo';

    interface ServiceConfigItem {
      /** The backend service base url */
      baseURL: string;
      /** The proxy pattern of the backend service base url */
      proxyPattern: string;
    }

    interface OtherServiceConfigItem extends ServiceConfigItem {
      key: OtherBaseURLKey;
    }

    /** The backend service config */
    interface ServiceConfig extends ServiceConfigItem {
      /** Other backend service config */
      other: OtherServiceConfigItem[];
    }

    interface SimpleServiceConfig extends Pick<ServiceConfigItem, 'baseURL'> {
      other: Record<OtherBaseURLKey, string>;
    }

    /** The backend service response data */
    type Response<T = unknown> = {
      /** The backend service response code */
      code: string;
      /** The backend service response message */
      message: string;
      /** The backend service response data */
      data: T;
    };

    /** The demo backend service response data */
    type DemoResponse<T = unknown> = {
      /** The backend service response code */
      status: string;
      /** The backend service response message */
      message: string;
      /** The backend service response data */
      result: T;
    };
  }
}
