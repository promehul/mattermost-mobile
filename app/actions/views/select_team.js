// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import {ChannelTypes, TeamTypes} from '@mm-redux/action_types';
import {getMyTeams} from '@mm-redux/actions/teams';
import {RequestStatus} from '@mm-redux/constants';
import {getConfig} from '@mm-redux/selectors/entities/general';
import {getCurrentUser} from '@mm-redux/selectors/entities/users';
import EventEmitter from '@mm-redux/utils/event_emitter';

import {NavigationTypes} from 'app/constants';
import {selectFirstAvailableTeam} from 'app/utils/teams';
import {isGuest} from 'app/utils/users';

export function handleTeamChange(teamId) {
    return async (dispatch, getState) => {
        const state = getState();
        const {currentTeamId} = state.entities.teams;
        if (currentTeamId === teamId) {
            return;
        }

        dispatch(batchActions([
            {type: TeamTypes.SELECT_TEAM, data: teamId},
            {type: ChannelTypes.SELECT_CHANNEL, data: '', extra: {}},
        ], 'BATCH_SWITCH_TEAM'));
    };
}

export function selectDefaultTeam() {
    return async (dispatch, getState) => {
        const state = getState();

        const {ExperimentalPrimaryTeam} = getConfig(state);
        const {teams, myMembers} = state.entities.teams;
        const myTeams = Object.keys(teams).reduce((result, id) => {
            if (myMembers[id]) {
                result.push(teams[id]);
            }

            return result;
        }, []);

        let defaultTeam = selectFirstAvailableTeam(myTeams, ExperimentalPrimaryTeam);

        if (defaultTeam) {
            dispatch(handleTeamChange(defaultTeam.id));
        } else if (state.requests.teams.getTeams.status === RequestStatus.FAILURE || state.requests.teams.getMyTeams.status === RequestStatus.FAILURE) {
            EventEmitter.emit(NavigationTypes.NAVIGATION_ERROR_TEAMS);
        } else {
            // If for some reason we reached this point cause of a failure in rehydration or something
            // lets fetch the teams one more time to make sure the user does not belong to any team
            const {data, error} = await dispatch(getMyTeams());
            if (error) {
                EventEmitter.emit(NavigationTypes.NAVIGATION_ERROR_TEAMS);
                return;
            }

            if (data) {
                defaultTeam = selectFirstAvailableTeam(data, ExperimentalPrimaryTeam);
            }

            if (defaultTeam) {
                dispatch(handleTeamChange(defaultTeam.id));
            } else {
                const currentUser = getCurrentUser(state);
                EventEmitter.emit(NavigationTypes.NAVIGATION_NO_TEAMS, isGuest(currentUser));
            }
        }
    };
}

export default {
    handleTeamChange,
    selectDefaultTeam,
};
