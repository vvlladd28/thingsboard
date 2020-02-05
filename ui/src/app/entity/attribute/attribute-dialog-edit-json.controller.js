/*
 * Copyright © 2016-2019 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-enable import/no-unresolved, import/default */

/*@ngInject*/
export default function AttributeDialogEditJsonController($scope, $mdDialog, $document, $window, jsonValue) { //eslint-disable-line

    let vm = this;
    vm.doc = $document[0];
    vm.jsonValue = angular.copy(jsonValue);
    console.log("vm.jsonValue DialogEditJson", vm.jsonValue);  //eslint-disable-line
    // vm.configAreaOptions = {
    //     useWrapMode: false,
    //     mode: 'json',
    //     showGutter: true,
    //     showPrintMargin: true,
    //     theme: 'github',
    //     advanced: {
    //         enableSnippets: true,
    //         enableBasicAutocompletion: true,
    //         enableLiveAutocompletion: true
    //     },
    //     onLoad: function (_ace) {
    //         _ace.$blockScrolling = 1;
    //     }
    // };

    // vm.validateConfig = (model, editorName) => {
    //     if (model && model.length) {
    //         try {
    //             angular.fromJson(model);
    //             $scope.theForm[editorName].$setValidity('attributeJSON', true);
    //         } catch (e) {
    //             $scope.theForm[editorName].$setValidity('attributeJSON', false);
    //         }
    //     }
    // };

    vm.save = () => {
        $mdDialog.hide(vm.jsonValue);
    };

    vm.cancel = () => {
        $mdDialog.hide();
    };

    // vm.beautifyJson = () => {
    //     vm.jsonValue = js_beautify(vm.jsonValue, {indent_size: 4});
    // };

}
