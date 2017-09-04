import React, { Component } from "react";
import { Button, Row, Col, Container } from "reactstrap";
import gql from "graphql-tag";
import Immutable from "immutable";
import { graphql, compose } from "react-apollo";
import Engine1 from "./engine-1";
import Engine2 from "./engine-2";
import Tour from "reactour";

import "./style.scss";

const SPEEDCHANGE_SUB = gql`
  subscription SpeedChanged {
    speedChange {
      id
      speed
    }
  }
`;

const HEATCHANGE_SUB = gql`
  subscription HeatChanged {
    heatChange {
      id
      heat
      coolant
    }
  }
`;

const SYSTEMS_SUB = gql`
  subscription SystemsUpdate($simulatorId: ID, $type: String) {
    systemsUpdate(simulatorId: $simulatorId, type: $type) {
      id
      power {
        power
        powerLevels
      }
      damage {
        damaged
        report
      }
    }
  }
`;

class EngineControl extends Component {
  constructor(props) {
    super(props);
    this.setSpeedSubscription = null;
    this.heatChangeSubscription = null;
    this.systemSub = null;
  }

  componentWillReceiveProps(nextProps) {
    if (!this.setSpeedSubscription && !nextProps.data.loading) {
      this.setSpeedSubscription = nextProps.data.subscribeToMore({
        document: SPEEDCHANGE_SUB,
        updateQuery: (previousResult, { subscriptionData }) => {
          const engines = previousResult.engines.map(engine => {
            if (engine.id === subscriptionData.data.speedChange.id) {
              return Object.assign({}, engine, {
                speed: subscriptionData.data.speedChange.speed
              });
            }
            return engine;
          });
          return Object.assign({}, previousResult, { engines });
        }
      });
    }
    if (!this.heatChangeSubscription && !nextProps.data.loading) {
      this.heatChangeSubscription = nextProps.data.subscribeToMore({
        document: HEATCHANGE_SUB,
        updateQuery: (previousResult, { subscriptionData }) => {
          const engineIndex = previousResult.engines.findIndex(
            e => e.id === subscriptionData.data.heatChange.id
          );
          if (engineIndex < 0) {
            return previousResult;
          }
          const engine = Immutable.Map(previousResult.engines[engineIndex]);
          engine.set("heat", subscriptionData.data.heatChange.heat);
          engine.set("coolant", subscriptionData.data.heatChange.coolant);
          return {
            engines: Immutable.List(previousResult.engines)
              .set(engineIndex, engine)
              .toJS()
          };
        }
      });
    }
    if (!this.systemSub && !nextProps.data.loading) {
      this.systemSub = nextProps.data.subscribeToMore({
        document: SYSTEMS_SUB,
        variables: {
          simulatorId: nextProps.simulator.id,
          type: "Engine"
        },
        updateQuery: (previousResult, { subscriptionData }) => {
          return Immutable.Map(previousResult)
            .mergeWith(
              (oldVal, newVal, key) => {
                return newVal.map((e, index) =>
                  Immutable.Map(oldVal[index]).merge({
                    damage: e.get("damage"),
                    power: e.get("power")
                  })
                );
              },
              { engines: subscriptionData.data.systemsUpdate }
            )
            .toJS();
        }
      });
    }
  }
  componentWillUnmount() {
    this.heatChangeSubscription();
    this.setSpeedSubscription();
    this.systemSub();
  }
  speedBarStyle(array, speed, engineCount, index) {
    let width = speed / array.length * 100;
    if (engineCount - 1 === index) {
      return {
        width: `calc(${width}%)`
      };
    }
    return {
      width: `calc(${width}% - ${40 / array.length * speed}px)`
    };
  }
  setSpeed(engine, speed) {
    if (!engine.damage.damaged) {
      this.props.setSpeed({ id: engine.id, speed: speed + 1, on: true });
    }
  }
  fullStop() {
    this.props.data.engines.forEach(engine => {
      this.props.setSpeed({ id: engine.id, speed: -1, on: false });
    });
  }
  render() {
    const engines = this.props.data.engines || [];
    return (
      <Container fluid className="EngineControl">
        <Row>
          <Col className="col-sm-12 enginesBar">
            {(() => {
              return engines.map((engine, index) => {
                return (
                  <div key={engine.id} className="engineGroup">
                    <h4>
                      {engine.name}
                    </h4>
                    <ul className="engine">
                      {engine.speeds.map((speed, speedIndex) => {
                        let speedWord = speed;
                        if (typeof speed === "object") {
                          speedWord = speed.number;
                        }
                        return (
                          <li
                            key={`${engine.id}-${speedWord}`}
                            className="speedNums speedBtn"
                            onClick={() => {
                              this.setSpeed(engine, speedIndex, engines, index);
                            }}
                          >
                            {speedWord}
                          </li>
                        );
                      })}
                    </ul>
                    <div
                      className="speedBar"
                      style={this.speedBarStyle(
                        engine.speeds,
                        engine.speed,
                        engines.length,
                        index
                      )}
                    />
                  </div>
                );
              });
            })()}
          </Col>
          <Col className="col-sm-4 offset-sm-4">
            <Button
              className="full-stop"
              color="warning"
              block
              onClick={this.fullStop.bind(this)}
            >
              Full Stop
            </Button>
          </Col>
        </Row>
        <Row>
          <Col>
            {engines.length === 1 &&
              <Engine1 engines={engines} setSpeed={this.setSpeed.bind(this)} />}
            {engines.length === 2 &&
              <Engine2 engines={engines} setSpeed={this.setSpeed.bind(this)} />}
          </Col>
        </Row>
        <Tour
          steps={trainingSteps}
          isOpen={this.props.clientObj.training}
          onRequestClose={this.props.stopTraining}
        />
      </Container>
    );
  }
}

const trainingSteps = [
  {
    selector: ".enginesBar",
    content:
      "This is where you can see your current speed. The yellow bar indicates how fast you are currently going. You can also click on the numbers here to change your speed."
  },
  {
    selector: "button.speedBtn",
    content: "You can click on any of these buttons to change the speed too."
  },
  {
    selector: ".full-stop",
    content: "Click this button to stop the ship entirely."
  },
  {
    selector: ".heat",
    content:
      "Watch your heat to make sure it doesn't get too high! Your engines could become damaged if they get too hot."
  },
  {
    selector: ".cool-engines",
    content:
      "You can cool down your engines with coolant by clicking this button."
  },
  {
    selector: ".coolant",
    content:
      "If you run out of coolant, one of the crew members is in charge of giving you more. Ask around."
  }
];

const ENGINE_QUERY = gql`
  query getEngines($simulatorId: ID!) {
    engines(simulatorId: $simulatorId) {
      id
      name
      power {
        power
        powerLevels
      }
      damage {
        damaged
        report
      }
      speeds {
        text
        number
      }
      heat
      speed
      coolant
    }
  }
`;

const SET_SPEED = gql`
  mutation setSpeed($id: ID!, $speed: Int!, $on: Boolean) {
    setSpeed(id: $id, speed: $speed, on: $on)
  }
`;
export default compose(
  graphql(ENGINE_QUERY, {
    options: ownProps => ({ variables: { simulatorId: ownProps.simulator.id } })
  }),
  graphql(SET_SPEED, {
    name: "setSpeed",
    props: ({ setSpeed }) => ({
      setSpeed: props =>
        setSpeed({
          variables: Object.assign(props)
        })
    })
  })
)(EngineControl);