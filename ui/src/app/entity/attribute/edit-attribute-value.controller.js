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
/*@ngInject*/
export default function EditAttributeValueController($scope, $q, $element, types, attributeValue, valueType, save) {

    $scope.valueTypes = types.valueType;

    $scope.model = {};

    $scope.model.value = attributeValue;

    switch (valueType) {
        case "S":
            $scope.valueType = types.valueType.string;
            break;
        case "L":
            $scope.valueType = types.valueType.integer;
            break;
        case "D":
            $scope.valueType = types.valueType.double;
            break;
        case "B":
            $scope.valueType = types.valueType.boolean;
            break;
        case "J":
            $scope.valueType = types.valueType.json;
            console.log('$scope.model.value do', $scope.model.value);   //eslint-disable-line
            $scope.model.value = angular.toJson(attributeValue);
            console.log('$scope.model.value after', $scope.model.value);    //eslint-disable-line
            break;
         default:
             $scope.valueType = types.valueType.string;
            break;
    }

    $scope.submit = submit;
    $scope.dismiss = dismiss;

    function dismiss() {
        $element.remove();
    }

    function update() {
        if($scope.editDialog.$invalid) {
            return $q.reject();
        }

        if(angular.isFunction(save)) {
            return $q.when(save($scope.model));
        }

        return $q.resolve();
    }

    function submit() {
        update().then(function () {
            $scope.dismiss();
        });
    }

    $scope.$watch('valueType', function(newVal, prevVal) {
        if (newVal != prevVal) {
            if ($scope.valueType === types.valueType.boolean) {
                $scope.model.value = false;
            } else {
                $scope.model.value = null;
            }
        }
    });
}
