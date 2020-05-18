// @flow

import { generateRoomWithoutSeparator } from 'js-utils/random';
import { Component } from 'react';
import type { Dispatch } from 'redux';

import AsyncStorage from '@react-native-community/async-storage';

import uuid from 'uuid';

import { createWelcomePageEvent, sendAnalytics } from '../../analytics';
import { appNavigate } from '../../app';
import { isCalendarEnabled } from '../../calendar-sync';
import { isRecentListEnabled } from '../../recent-list/functions';

/**
 * {@code AbstractWelcomePage}'s React {@code Component} prop types.
 */
type Props = {

    /**
     * Whether the calendar functionality is enabled or not.
     */
    _calendarEnabled: boolean,

    /**
     * Whether the recent list is enabled
     */
    _recentListEnabled: Boolean,

    /**
     * Room name to join to.
     */
    _room: string,

    /**
     * The current settings.
     */
    _settings: Object,

    /**
     * The Redux dispatch Function.
     */
    dispatch: Dispatch<any>
};

/**
 * Base (abstract) class for container component rendering the welcome page.
 *
 * @abstract
 */
export class AbstractWelcomePage extends Component<Props, *> {
    _mounted: ?boolean;

    /**
     * Implements React's {@link Component#getDerivedStateFromProps()}.
     *
     * @inheritdoc
     */
    static getDerivedStateFromProps(props: Props, state: Object) {
        return {
            room: props._room || state.room
        };
    }

    /**
     * Save room name into component's local state.
     *
     * @type {Object}
     * @property {number|null} animateTimeoutId - Identifier of the letter
     * animation timeout.
     * @property {string} generatedRoomname - Automatically generated room name.
     * @property {string} room - Room name.
     * @property {string} roomPlaceholder - Room placeholder that's used as a
     * placeholder for input.
     * @property {nubmer|null} updateTimeoutId - Identifier of the timeout
     * updating the generated room name.
     */
    state = {
        animateTimeoutId: undefined,
        generatedRoomname: '',
        joining: false,
        room: '',
        roomPlaceholder: '',
        updateTimeoutId: undefined,
        errorMsg: ''
    };

    /**
     * Initializes a new {@code AbstractWelcomePage} instance.
     *
     * @param {Props} props - The React {@code Component} props to initialize
     * the new {@code AbstractWelcomePage} instance with.
     */
    constructor(props: Props) {
        super(props);

        // Bind event handlers so they are only bound once per instance.
        this._animateRoomnameChanging
            = this._animateRoomnameChanging.bind(this);
        this._onJoin = this._onJoin.bind(this);
        this._onRoomChange = this._onRoomChange.bind(this);
        this._updateRoomname = this._updateRoomname.bind(this);
        this.b64DecodeUnicode = this.b64DecodeUnicode.bind(this);
    }

    /**
     * Implements React's {@link Component#componentDidMount()}. Invoked
     * immediately after mounting occurs.
     *
     * @inheritdoc
     */
    componentDidMount() {
        this._mounted = true;
        sendAnalytics(createWelcomePageEvent('viewed', undefined, { value: 1 }));
    }

    /**
     * Implements React's {@link Component#componentWillUnmount()}. Invoked
     * immediately before this component is unmounted and destroyed.
     *
     * @inheritdoc
     */
    componentWillUnmount() {
        this._clearTimeouts();
        this._mounted = false;
    }

    _animateRoomnameChanging: (string) => void;

    /**
     * Animates the changing of the room name.
     *
     * @param {string} word - The part of room name that should be added to
     * placeholder.
     * @private
     * @returns {void}
     */
    _animateRoomnameChanging(word: string) {
        let animateTimeoutId;
        const roomPlaceholder = this.state.roomPlaceholder + word.substr(0, 1);

        if (word.length > 1) {
            animateTimeoutId
                = setTimeout(
                    () => {
                        this._animateRoomnameChanging(
                            word.substring(1, word.length));
                    },
                    70);
        }
        this.setState({
            animateTimeoutId,
            roomPlaceholder
        });
    }

    /**
     * Method that clears timeouts for animations and updates of room name.
     *
     * @private
     * @returns {void}
     */
    _clearTimeouts() {
        clearTimeout(this.state.animateTimeoutId);
        clearTimeout(this.state.updateTimeoutId);
    }

    _onJoin: () => void;

    /**
     * Handles joining. Either by clicking on 'Join' button
     * or by pressing 'Enter' in room name input field.
     *
     * @protected
     * @returns {void}
     */
    async _onJoin() {
        const room = this.state.room || this.state.generatedRoomname;

        console.log('room url: ', this.state.room);

        const OLD_MEET_SERVER = "https://sitmeet.goodgrid.com";

        /* let lk = this.b64DecodeUnicode(room);

        console.log('lk: ', lk);

        let url_data = lk.split("#");

        console.log('yrl_data: ', url_data); */
        let meeting_title = '';
        let room_url = '';
        let send_body_m = 'meeting_id=' + encodeURIComponent(room);
        console.log('body: ', send_body_m);
        await fetch(`${OLD_MEET_SERVER}/service/check_meeting_mobile.php?meeting_id=${room}&device_id=${uuid}&display_name=${uuid}`, {
        method: 'GET',
        headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Token': 'mobile_token_hjlgdzZUIgdshzidhksdzxdbjgbkzdkbk'
        }
        // body: [send_body_m]
        })
        .then((response) => response.json())
        .then((responseData) => {
            console.log('response: ', responseData);
            if(responseData.status === 'error'){

                //Wrong room name! Please use correct room ID;
                console.log('Wrong room name! Please use correct room ID');
                this.setState({ errorMsg: responseData.description });
            }
            else {
                meeting_title = responseData.title;
                this._updateRoomname(responseData.title);
                AsyncStorage.setItem('TITLE', JSON.stringify(responseData.title));
                console.log('room_url: ', room_url, meeting_title);
                this.setState({ room: responseData.room_url, generatedRoomname: responseData.title });
                sendAnalytics(
                    createWelcomePageEvent('clicked', 'joinButton', {
                        isGenerated: !responseData.room_url,
                        room_url: responseData.room_url
                    }));
        
                if (responseData.room_url) {
                    this.setState({ joining: true });
        
                    // By the time the Promise of appNavigate settles, this component
                    // may have already been unmounted.
                    const onAppNavigateSettled
                        = () => this._mounted && this.setState({ joining: false });
        
                    this.props.dispatch(appNavigate(responseData.room_url))
                        .then(onAppNavigateSettled, onAppNavigateSettled);
                }
            }
        });

    }

    b64DecodeUnicode(str) {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    _onRoomChange: (string) => void;

    /**
     * Handles 'change' event for the room name text input field.
     *
     * @param {string} value - The text typed into the respective text input
     * field.
     * @protected
     * @returns {void}
     */
    _onRoomChange(value: string) {
        this.setState({ room: value });
    }

    _updateRoomname: () => void;

    /**
     * Triggers the generation of a new room name and initiates an animation of
     * its changing.
     *
     * @protected
     * @returns {void}
     */
    _updateRoomname() {
        const generatedRoomname = generateRoomWithoutSeparator();
        const roomPlaceholder = '';
        const updateTimeoutId = setTimeout(this._updateRoomname, 10000);

        this._clearTimeouts();
        this.setState(
            {
                generatedRoomname,
                roomPlaceholder,
                updateTimeoutId
            },
            () => this._animateRoomnameChanging(generatedRoomname));
    }
}

/**
 * Maps (parts of) the redux state to the React {@code Component} props of
 * {@code AbstractWelcomePage}.
 *
 * @param {Object} state - The redux state.
 * @protected
 * @returns {{
 *     _calendarEnabled: boolean,
 *     _room: string,
 *     _settings: Object
 * }}
 */
export function _mapStateToProps(state: Object) {
    return {
        _calendarEnabled: isCalendarEnabled(state),
        _recentListEnabled: isRecentListEnabled(),
        _room: state['features/base/conference'].room,
        _settings: state['features/base/settings']
    };
}
